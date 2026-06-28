#![no_std]
//! Confidential Payroll - Soroban contract (verifier-gateway + funded pool).
//!
//! `run_payroll` gates on a batch ZK proof via a cross-contract call to the UltraHonk
//! verifier (`rs-soroban-ultrahonk`, native BN254 host functions). The contract does NO
//! elliptic-curve math; correctness (range, conservation, encryption) is proven inside the
//! Noir circuit. Integrity comes from reading the per-recipient ciphertexts and the revealed
//! total DIRECTLY from the verifier-attested `public_inputs` - never from unchecked args.
//!
//! Privacy model: individual salaries stay hidden inside the EC-ElGamal ciphertexts; the
//! aggregate `total` is revealed (auditor-visible) and conserved against a funded pool.
//!
//! Public-input layout (per the circuit, 32-byte big-endian field elements):
//!   per recipient i (6 fields): pk.x, pk.y, c1.x, c1.y, c2.x, c2.y
//!   final field: total
//! => N = (num_fields - 1) / 6 ; each stored ciphertext = c1.x|c1.y|c2.x|c2.y (128 bytes).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, vec, Address, Bytes,
    BytesN, Env, IntoVal, Symbol,
};

const FIELD: u32 = 32; // bytes per field element

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Verifier,
    Token, // SAC address of the payroll asset (e.g. USDC)
    Pool,  // available-to-distribute (funded - distributed)
    Balance(u32), // recipient index -> stored ElGamal ciphertext (c1|c2, 128 bytes)
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
}

#[contract]
pub struct ConfidentialPayroll;

#[contractimpl]
impl ConfidentialPayroll {
    /// Wire up the verifier and payroll token (SAC) at deploy time; pool starts empty.
    pub fn __constructor(env: Env, verifier: Address, token: Address) {
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Pool, &0i128);
    }

    /// Fund the payroll pool with real tokens: pulls `amount` of the payroll asset from
    /// `from` into the contract via the SAC, and credits the available pool.
    pub fn fund(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(&env, &token).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        let pool: i128 = env.storage().instance().get(&DataKey::Pool).unwrap_or(0);
        env.storage().instance().set(&DataKey::Pool, &(pool + amount));
    }

    /// Available-to-distribute amount (funded - distributed).
    pub fn pool(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Pool).unwrap_or(0)
    }

    /// Actual token amount held in custody by the contract.
    pub fn custody(env: Env) -> i128 {
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(&env, &token).balance(&env.current_contract_address())
    }

    pub fn token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Token)
    }

    /// Run confidential payroll for a batch. `public_inputs` + `proof` come from the
    /// client-side Noir prover. The contract verifies the proof, then derives the revealed
    /// total and the per-recipient ciphertexts FROM the attested public inputs.
    pub fn run_payroll(
        env: Env,
        employer: Address,
        period_nonce: BytesN<32>,
        public_inputs: Bytes,
        proof: Bytes,
    ) -> Result<u32, Error> {
        employer.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DataKey::UsedNonce(period_nonce.clone()))
        {
            return Err(Error::ReplayedNonce);
        }

        // layout: 6 fields per recipient + 1 total field
        let num_fields = public_inputs.len() / FIELD;
        if public_inputs.len() % FIELD != 0 || num_fields < 7 || (num_fields - 1) % 6 != 0 {
            return Err(Error::BadPublicInputs);
        }
        let n = (num_fields - 1) / 6;

        // Verification gateway: traps on an invalid proof -> whole tx reverts.
        let verifier: Address = env
            .storage()
            .instance()
            .get(&DataKey::Verifier)
            .ok_or(Error::NotInitialized)?;
        let verify_fn: Symbol = Symbol::new(&env, "verify_proof");
        let args = vec![&env, public_inputs.clone().into_val(&env), proof.into_val(&env)];
        env.invoke_contract::<()>(&verifier, &verify_fn, args);

        // Conservation: revealed total (last field) debited from the pool.
        let total_start = (num_fields - 1) * FIELD;
        let total = read_u128_be(&public_inputs, total_start + 16, 16); // low 16 bytes
        let pool: i128 = env.storage().instance().get(&DataKey::Pool).unwrap_or(0);
        let total_i = total as i128;
        if pool < total_i {
            return Err(Error::InsufficientPool);
        }
        env.storage().instance().set(&DataKey::Pool, &(pool - total_i));

        // Integrity: store each recipient ciphertext (c1.x|c1.y|c2.x|c2.y) sliced from the
        // verifier-attested public inputs.
        for i in 0..n {
            let ct_start = (6 * i + 2) * FIELD; // skip pk.x, pk.y
            let ct = public_inputs.slice(ct_start..ct_start + 4 * FIELD);
            env.storage().persistent().set(&DataKey::Balance(i), &ct);
        }

        env.storage()
            .persistent()
            .set(&DataKey::UsedNonce(period_nonce), &true);
        env.events()
            .publish((symbol_short!("payroll"), employer), (n, total_i));
        Ok(n)
    }

    /// Read a stored (still-encrypted) balance ciphertext by recipient index.
    pub fn balance_of(env: Env, index: u32) -> Option<Bytes> {
        env.storage().persistent().get(&DataKey::Balance(index))
    }

    pub fn verifier(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Verifier)
    }
}

/// Read `len` big-endian bytes from `b` starting at `start` into a u128.
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
