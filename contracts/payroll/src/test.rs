#![cfg(test)]
use super::*;
use soroban_sdk::{
    contract, contractimpl, testutils::Address as _, token, Address, Bytes, BytesN, Env,
};

// --- mock UltraHonk verifier: Ok unless the proof is empty (lets us test gateway behaviour
// without real cryptography; the real verifier is exercised on testnet). ---
#[contract]
pub struct MockVerifier;

#[contractimpl]
impl MockVerifier {
    pub fn verify_proof(_env: Env, _public_inputs: Bytes, proof: Bytes) -> Result<(), Error> {
        if proof.len() == 0 {
            return Err(Error::BadPublicInputs);
        }
        Ok(())
    }
}

const FIELD: usize = 32;

/// Build a 4-recipient batch `public_inputs` blob (25 fields, 800 bytes), v2 layout: per recipient
/// — ciphertext (fields 6i..6i+4) tagged `(i+1)`, pk_spend (fields 6i+4..6i+6) tagged `(i+101)` —
/// then total. Lets us assert both Balance and Owner storage.
fn batch_public_inputs(env: &Env, total: u64) -> Bytes {
    let mut buf = [0u8; 800];
    for i in 0..4usize {
        let ct = (6 * i) * FIELD; // ciphertext: fields 6i..6i+4 (128 bytes)
        for b in buf[ct..ct + 4 * FIELD].iter_mut() {
            *b = (i + 1) as u8;
        }
        let owner = (6 * i + 4) * FIELD; // pk_spend: fields 6i+4..6i+6 (64 bytes)
        for b in buf[owner..owner + 2 * FIELD].iter_mut() {
            *b = (i + 101) as u8;
        }
    }
    let off = (6 * 4) * FIELD + FIELD - 8; // total field, low 8 bytes
    buf[off..off + 8].copy_from_slice(&total.to_be_bytes());
    Bytes::from_slice(env, &buf)
}

fn setup(env: &Env) -> (Address, Address, Address, Address) {
    let admin = Address::generate(env);
    let verifier = env.register(MockVerifier, ());
    let wverifier = env.register(MockVerifier, ());
    let sac = env.register_stellar_asset_contract_v2(admin);
    (verifier, wverifier, sac.address(), {
        let employer = Address::generate(env);
        employer
    })
}

#[test]
fn fund_then_payroll_conserves_and_stores() {
    let env = Env::default();
    env.mock_all_auths();
    let (v, wv, tok, employer) = setup(&env);
    token::StellarAssetClient::new(&env, &tok).mint(&employer, &50_000i128);

    let id = env.register(ConfidentialPayroll, (v, wv, tok.clone()));
    let c = ConfidentialPayrollClient::new(&env, &id);

    c.fund(&employer, &20_000i128);
    assert_eq!(c.pool(), 20_000);
    assert_eq!(c.custody(), 20_000);

    let pi = batch_public_inputs(&env, 15_050);
    let proof = Bytes::from_slice(&env, &[1u8; 8]);
    let nonce = BytesN::from_array(&env, &[1u8; 32]);
    let n = c.run_payroll(&employer, &nonce, &pi, &proof);
    assert_eq!(n, 4);

    // conservation: pool debited by the revealed total
    assert_eq!(c.pool(), 20_000 - 15_050);
    // integrity: stored ciphertext + owner equal the public-input slices
    assert_eq!(c.balance_of(&0u32).unwrap(), Bytes::from_slice(&env, &[1u8; 128]));
    assert_eq!(c.owner_of(&0u32).unwrap(), Bytes::from_slice(&env, &[101u8; 64]));
    assert_eq!(c.balance_of(&3u32).unwrap(), Bytes::from_slice(&env, &[4u8; 128]));
    assert_eq!(c.owner_of(&3u32).unwrap(), Bytes::from_slice(&env, &[104u8; 64]));
}

#[test]
fn replayed_nonce_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (v, wv, tok, employer) = setup(&env);
    token::StellarAssetClient::new(&env, &tok).mint(&employer, &50_000i128);
    let id = env.register(ConfidentialPayroll, (v, wv, tok.clone()));
    let c = ConfidentialPayrollClient::new(&env, &id);
    c.fund(&employer, &40_000i128);

    let pi = batch_public_inputs(&env, 15_050);
    let proof = Bytes::from_slice(&env, &[1u8; 8]);
    let nonce = BytesN::from_array(&env, &[7u8; 32]);
    c.run_payroll(&employer, &nonce, &pi, &proof);
    // same nonce again -> ReplayedNonce
    let res = c.try_run_payroll(&employer, &nonce, &pi, &proof);
    assert_eq!(res, Err(Ok(Error::ReplayedNonce)));
}

#[test]
fn insufficient_pool_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (v, wv, tok, employer) = setup(&env);
    token::StellarAssetClient::new(&env, &tok).mint(&employer, &50_000i128);
    let id = env.register(ConfidentialPayroll, (v, wv, tok.clone()));
    let c = ConfidentialPayrollClient::new(&env, &id);
    c.fund(&employer, &10_000i128); // less than the 15,050 total

    let pi = batch_public_inputs(&env, 15_050);
    let proof = Bytes::from_slice(&env, &[1u8; 8]);
    let nonce = BytesN::from_array(&env, &[9u8; 32]);
    let res = c.try_run_payroll(&employer, &nonce, &pi, &proof);
    assert_eq!(res, Err(Ok(Error::InsufficientPool)));
}

#[test]
fn invalid_proof_reverts_payroll() {
    let env = Env::default();
    env.mock_all_auths();
    let (v, wv, tok, employer) = setup(&env);
    token::StellarAssetClient::new(&env, &tok).mint(&employer, &50_000i128);
    let id = env.register(ConfidentialPayroll, (v, wv, tok.clone()));
    let c = ConfidentialPayrollClient::new(&env, &id);
    c.fund(&employer, &40_000i128);

    let pi = batch_public_inputs(&env, 15_050);
    let empty_proof = Bytes::new(&env); // mock verifier traps on empty proof
    let nonce = BytesN::from_array(&env, &[5u8; 32]);
    let res = c.try_run_payroll(&employer, &nonce, &pi, &empty_proof);
    assert!(res.is_err()); // cross-call trapped -> whole tx reverts
    // nothing applied
    assert_eq!(c.pool(), 40_000);
    assert_eq!(c.balance_of(&0u32), None);
}
