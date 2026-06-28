#![no_std]
//! Confidential Payroll - Soroban contract (verifier-gateway).
//!
//! `run_payroll` gates on a batch ZK proof: it makes a cross-contract call to the
//! deployed UltraHonk verifier (`rs-soroban-ultrahonk`, native BN254 host functions).
//! If the proof is invalid the verifier traps and the whole payroll run reverts.
//! On success the per-recipient encrypted balances (opaque ElGamal ciphertexts) are
//! stored. The contract does NO elliptic-curve math itself - correctness (range,
//! conservation, encryption) is proven inside the Noir circuit. See docs/architecture.md.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Bytes,
    BytesN, Env, IntoVal, Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// deployed UltraHonk verifier contract
    Verifier,
    /// recipient index -> stored encrypted balance ciphertext (C1 || C2)
    Balance(u32),
    /// consumed payroll-period nonces (anti-replay)
    UsedNonce(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ReplayedNonce = 3,
}

#[contract]
pub struct ConfidentialPayroll;

#[contractimpl]
impl ConfidentialPayroll {
    /// Wire up the verifier contract at deploy time.
    pub fn __constructor(env: Env, verifier: Address) {
        env.storage().instance().set(&DataKey::Verifier, &verifier);
    }

    /// Run confidential payroll for a batch.
    ///
    /// `public_inputs` + `proof` come from the client-side Noir prover. `new_cts` are the
    /// per-recipient updated ciphertexts to store (their correctness is attested by the proof).
    pub fn run_payroll(
        env: Env,
        employer: Address,
        period_nonce: BytesN<32>,
        public_inputs: Bytes,
        proof: Bytes,
        new_cts: Vec<Bytes>,
    ) -> Result<(), Error> {
        employer.require_auth();

        // anti-replay
        if env
            .storage()
            .persistent()
            .has(&DataKey::UsedNonce(period_nonce.clone()))
        {
            return Err(Error::ReplayedNonce);
        }

        let verifier: Address = env
            .storage()
            .instance()
            .get(&DataKey::Verifier)
            .ok_or(Error::NotInitialized)?;

        // Verification gateway: cross-contract call. The verifier returns void on success
        // and TRAPS on an invalid proof, which reverts this whole transaction.
        let verify_fn: Symbol = Symbol::new(&env, "verify_proof");
        let args = vec![
            &env,
            public_inputs.into_val(&env),
            proof.into_val(&env),
        ];
        env.invoke_contract::<()>(&verifier, &verify_fn, args);

        // Apply: store new encrypted balances (opaque bytes).
        let mut i: u32 = 0;
        for ct in new_cts.iter() {
            env.storage().persistent().set(&DataKey::Balance(i), &ct);
            i += 1;
        }

        env.storage()
            .persistent()
            .set(&DataKey::UsedNonce(period_nonce), &true);

        env.events()
            .publish((symbol_short!("payroll"), employer), i);
        Ok(())
    }

    /// Read a stored (still-encrypted) balance ciphertext by recipient index.
    pub fn balance_of(env: Env, index: u32) -> Option<Bytes> {
        env.storage().persistent().get(&DataKey::Balance(index))
    }

    /// The wired verifier contract address.
    pub fn verifier(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Verifier)
    }
}

mod test;
