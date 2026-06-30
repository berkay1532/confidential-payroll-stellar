#![cfg(test)]
use super::*;
use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, vec, Address, Bytes, BytesN, Env,
};

// Mock confidential token: counts confidential_transfer calls so we can assert batching.
#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn confidential_transfer(env: Env, _from: Address, _to: Address, _data: Bytes) {
        let k = symbol_short!("count");
        let c: u32 = env.storage().instance().get(&k).unwrap_or(0);
        env.storage().instance().set(&k, &(c + 1));
    }
    pub fn count(env: Env) -> u32 {
        env.storage().instance().get(&symbol_short!("count")).unwrap_or(0)
    }
}

#[test]
fn batches_n_transfers_and_blocks_replay() {
    let env = Env::default();
    env.mock_all_auths();
    let token = env.register(MockToken, ());
    let id = env.register(PayrollOrchestrator, (token.clone(),));
    let c = PayrollOrchestratorClient::new(&env, &id);

    let employer = Address::generate(&env);
    let recipients = vec![
        &env,
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    let datas = vec![
        &env,
        Bytes::from_slice(&env, &[1]),
        Bytes::from_slice(&env, &[2]),
        Bytes::from_slice(&env, &[3]),
    ];
    let nonce = BytesN::from_array(&env, &[1u8; 32]);

    assert_eq!(c.run_payroll(&employer, &nonce, &recipients, &datas), 3);
    assert_eq!(MockTokenClient::new(&env, &token).count(), 3); // 3 confidential_transfers routed

    // replayed nonce -> rejected
    assert_eq!(
        c.try_run_payroll(&employer, &nonce, &recipients, &datas),
        Err(Ok(Error::ReplayedNonce))
    );
}

#[test]
fn len_mismatch_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let token = env.register(MockToken, ());
    let id = env.register(PayrollOrchestrator, (token,));
    let c = PayrollOrchestratorClient::new(&env, &id);
    let employer = Address::generate(&env);
    let recipients = vec![&env, Address::generate(&env)];
    let datas: soroban_sdk::Vec<Bytes> = vec![&env]; // 1 recipient, 0 datas
    let nonce = BytesN::from_array(&env, &[2u8; 32]);
    assert_eq!(
        c.try_run_payroll(&employer, &nonce, &recipients, &datas),
        Err(Ok(Error::LenMismatch))
    );
}
