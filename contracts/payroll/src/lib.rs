#![no_std]
//! Confidential Payroll — Soroban contract (skeleton).
//!
//! Design principle: this contract does NO elliptic-curve math on balances.
//! It stores encrypted balances as opaque bytes and only VERIFIES the batch
//! proof, then updates stored ciphertexts. All correctness (conservation,
//! range, encryption) is proven inside the Noir circuit. See docs/architecture.md.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Bytes, BytesN, Env, Map};

/// Opaque ElGamal ciphertext (C1, C2) as stored on-chain — the contract never
/// interprets these; it only checks they match the proof's public inputs.
pub type Ciphertext = Bytes;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// address -> encrypted balance ciphertext
    Balance(Address),
    /// employer encrypted balance
    Employer,
    /// consumed period nonces (anti-replay)
    UsedNonce(BytesN<32>),
    /// view-key registry: address -> auditor-readable key material
    ViewKey(Address),
    /// the deployed Verifier contract address
    Verifier,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Error {
    AlreadyInitialized = 1,
    InvalidProof = 2,
    ReplayedNonce = 3,
    StaleBalance = 4,
    NotAuthorized = 5,
}

#[contract]
pub struct ConfidentialPayroll;

#[contractimpl]
impl ConfidentialPayroll {
    /// Wire up the verifier contract once at deploy time.
    pub fn init(env: Env, verifier: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Verifier) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        Ok(())
    }

    /// Run confidential payroll for a batch of recipients.
    ///
    /// `proof` + `public_inputs` come from the client-side Noir prover.
    /// `recipients`/`new_cts` are the per-employee updated ciphertexts whose
    /// correctness is attested by the proof's public inputs.
    pub fn run_payroll(
        env: Env,
        employer: Address,
        proof: Bytes,
        public_inputs: Bytes,
        period_nonce: BytesN<32>,
        employer_new_ct: Ciphertext,
        recipients: soroban_sdk::Vec<Address>,
        new_cts: soroban_sdk::Vec<Ciphertext>,
    ) -> Result<(), Error> {
        employer.require_auth();

        // anti-replay: bind to (employer, period, action) — nonce must be fresh
        if env.storage().persistent().has(&DataKey::UsedNonce(period_nonce.clone())) {
            return Err(Error::ReplayedNonce);
        }

        // verification gateway: delegate pure crypto to the Verifier contract.
        // TODO(spike Gate 1): call verifier.verify(proof, public_inputs) once the
        // UltraHonk/BN254 Soroban verifier is wired up.
        let _verifier: Address = env
            .storage()
            .instance()
            .get(&DataKey::Verifier)
            .ok_or(Error::NotAuthorized)?;
        let verified = Self::verify(&env, &proof, &public_inputs);
        if !verified {
            return Err(Error::InvalidProof);
        }

        // TODO: assert public_inputs bind to current employer ciphertext (StaleBalance guard)

        // apply: store new employer + recipient ciphertexts atomically
        env.storage().persistent().set(&DataKey::Employer, &employer_new_ct);
        for (addr, ct) in recipients.iter().zip(new_cts.iter()) {
            env.storage().persistent().set(&DataKey::Balance(addr), &ct);
        }
        env.storage().persistent().set(&DataKey::UsedNonce(period_nonce), &true);
        Ok(())
    }

    /// Read your own (still-encrypted) balance ciphertext; decryption is client-side.
    pub fn balance_of(env: Env, who: Address) -> Option<Ciphertext> {
        env.storage().persistent().get(&DataKey::Balance(who))
    }

    /// Register a view key so an auditor can read totals without spend rights.
    pub fn register_view_key(env: Env, who: Address, view_key: Bytes) {
        who.require_auth();
        env.storage().persistent().set(&DataKey::ViewKey(who), &view_key);
    }

    // --- internal ---

    /// Placeholder for the proof verification gateway.
    /// Replaced in spike Gate 1 by a cross-contract call to the BN254/UltraHonk verifier.
    fn verify(_env: &Env, _proof: &Bytes, _public_inputs: &Bytes) -> bool {
        // TODO: cross-contract call to Verifier; returns true only for a valid proof.
        false
    }
}

mod test;
