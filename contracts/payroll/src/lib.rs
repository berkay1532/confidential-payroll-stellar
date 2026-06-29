#![no_std]
//! Confidential Payroll v2 — viewing key != spending key.
//!
//! Balances are ElGamal-encrypted under each recipient's VIEWING key (pk_view); the recipient's
//! SPENDING key (pk_spend) is stored as the owner. Withdrawal is gated by a ZK proof of knowledge
//! of sk_spend for the stored pk_spend — so a viewing key grants read (decrypt) but never spend.
//!
//! All correctness (range, conservation, encryption, ownership) is proven in the Noir circuits and
//! verified via cross-contract calls; integrity comes from reading values out of the
//! verifier-attested public inputs.
//!
//! Batch public-input layout (32-byte fields), per recipient (6 fields): c1.x,c1.y,c2.x,c2.y,
//!   pk_spend.x,pk_spend.y — then a final `total` field.  N = (num_fields - 1) / 6.
//! Withdraw public-input layout (11 fields): c1.x,c1.y,c2.x,c2.y (old ct) | pk_spend.x,pk_spend.y
//!   | w | c1'.x,c1'.y,c2'.x,c2'.y (new ct).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, vec, Address, Bytes,
    BytesN, Env, IntoVal, Symbol,
};

const FIELD: u32 = 32;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Verifier,
    WithdrawVerifier,
    Token,
    Pool,
    Balance(u32), // recipient -> ElGamal ciphertext (c1|c2, 128 bytes), encrypted under pk_view
    Owner(u32),   // recipient -> pk_spend (64 bytes); withdrawal must prove knowledge of sk_spend
    UsedNonce(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 2,
    ReplayedNonce = 3,
    BadPublicInputs = 4,
    InsufficientPool = 5,
    BalanceMismatch = 6,
    OwnerMismatch = 7,
    NoBalance = 8,
}

#[contract]
pub struct ConfidentialPayroll;

#[contractimpl]
impl ConfidentialPayroll {
    pub fn __constructor(env: Env, verifier: Address, withdraw_verifier: Address, token: Address) {
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        env.storage().instance().set(&DataKey::WithdrawVerifier, &withdraw_verifier);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Pool, &0i128);
    }

    pub fn fund(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(&env, &token).transfer(&from, &env.current_contract_address(), &amount);
        let pool: i128 = env.storage().instance().get(&DataKey::Pool).unwrap_or(0);
        env.storage().instance().set(&DataKey::Pool, &(pool + amount));
    }

    pub fn pool(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Pool).unwrap_or(0)
    }

    pub fn custody(env: Env) -> i128 {
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(&env, &token).balance(&env.current_contract_address())
    }

    /// Run confidential payroll. Verifies the batch proof, then stores each recipient's encrypted
    /// balance (under pk_view) + owner (pk_spend), and conserves the revealed total against the pool.
    pub fn run_payroll(
        env: Env,
        employer: Address,
        period_nonce: BytesN<32>,
        public_inputs: Bytes,
        proof: Bytes,
    ) -> Result<u32, Error> {
        employer.require_auth();
        if env.storage().persistent().has(&DataKey::UsedNonce(period_nonce.clone())) {
            return Err(Error::ReplayedNonce);
        }
        let num_fields = public_inputs.len() / FIELD;
        if public_inputs.len() % FIELD != 0 || num_fields < 7 || (num_fields - 1) % 6 != 0 {
            return Err(Error::BadPublicInputs);
        }
        let n = (num_fields - 1) / 6;

        let verifier: Address = env.storage().instance().get(&DataKey::Verifier).ok_or(Error::NotInitialized)?;
        let verify_fn: Symbol = Symbol::new(&env, "verify_proof");
        let args = vec![&env, public_inputs.clone().into_val(&env), proof.into_val(&env)];
        env.invoke_contract::<()>(&verifier, &verify_fn, args);

        // conservation
        let total_start = (num_fields - 1) * FIELD;
        let total = read_u128_be(&public_inputs, total_start + 16, 16) as i128;
        let pool: i128 = env.storage().instance().get(&DataKey::Pool).unwrap_or(0);
        if pool < total {
            return Err(Error::InsufficientPool);
        }
        env.storage().instance().set(&DataKey::Pool, &(pool - total));

        // store ciphertext (fields 0..4) + owner pk_spend (fields 4..6) per recipient
        for i in 0..n {
            let base = 6 * i * FIELD;
            let ct = public_inputs.slice(base..base + 4 * FIELD);
            let owner = public_inputs.slice(base + 4 * FIELD..base + 6 * FIELD);
            env.storage().persistent().set(&DataKey::Balance(i), &ct);
            env.storage().persistent().set(&DataKey::Owner(i), &owner);
        }

        env.storage().persistent().set(&DataKey::UsedNonce(period_nonce), &true);
        env.events().publish((symbol_short!("payroll"), employer), (n, total));
        Ok(n)
    }

    /// Withdraw a revealed amount. The proof attests knowledge of the SPENDING key for the stored
    /// owner + solvency; the contract checks the proof's old ciphertext and pk_spend match storage.
    pub fn withdraw(env: Env, employee: Address, index: u32, public_inputs: Bytes, proof: Bytes) -> Result<i128, Error> {
        employee.require_auth();
        if public_inputs.len() != 11 * FIELD {
            return Err(Error::BadPublicInputs);
        }
        let wv: Address = env.storage().instance().get(&DataKey::WithdrawVerifier).ok_or(Error::NotInitialized)?;
        let verify_fn: Symbol = Symbol::new(&env, "verify_proof");
        let args = vec![&env, public_inputs.clone().into_val(&env), proof.into_val(&env)];
        env.invoke_contract::<()>(&wv, &verify_fn, args);

        // old ciphertext (fields 0..4) must equal stored balance; pk_spend (fields 4..6) must equal owner
        let old_ct = public_inputs.slice(0..4 * FIELD);
        let pk_spend = public_inputs.slice(4 * FIELD..6 * FIELD);
        let stored: Bytes = env.storage().persistent().get(&DataKey::Balance(index)).ok_or(Error::NoBalance)?;
        let owner: Bytes = env.storage().persistent().get(&DataKey::Owner(index)).ok_or(Error::NoBalance)?;
        if stored != old_ct {
            return Err(Error::BalanceMismatch);
        }
        if owner != pk_spend {
            return Err(Error::OwnerMismatch);
        }

        // w = field 6 ; new ciphertext = fields 7..11
        let w = read_u128_be(&public_inputs, 6 * FIELD + 16, 16) as i128;
        let new_ct = public_inputs.slice(7 * FIELD..11 * FIELD);
        env.storage().persistent().set(&DataKey::Balance(index), &new_ct);

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(&env, &token).transfer(&env.current_contract_address(), &employee, &w);
        env.events().publish((symbol_short!("withdraw"), employee), (index, w));
        Ok(w)
    }

    pub fn balance_of(env: Env, index: u32) -> Option<Bytes> {
        env.storage().persistent().get(&DataKey::Balance(index))
    }
    pub fn owner_of(env: Env, index: u32) -> Option<Bytes> {
        env.storage().persistent().get(&DataKey::Owner(index))
    }
    pub fn verifier(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Verifier)
    }
    pub fn token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Token)
    }
}

fn read_u128_be(b: &Bytes, start: u32, len: u32) -> u128 {
    let mut acc: u128 = 0;
    let mut i = 0u32;
    while i < len {
        acc = (acc << 8) | (b.get(start + i).unwrap_or(0) as u128);
        i += 1;
    }
    acc
}

mod test;
