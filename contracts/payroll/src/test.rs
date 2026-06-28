#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn constructor_wires_verifier_pool_empty_balances_empty() {
    let env = Env::default();
    let verifier = Address::generate(&env);
    let contract_id = env.register(ConfidentialPayroll, (verifier.clone(),));
    let client = ConfidentialPayrollClient::new(&env, &contract_id);

    assert_eq!(client.verifier(), Some(verifier));
    assert_eq!(client.pool(), 0);
    assert_eq!(client.balance_of(&0u32), None);
}

#[test]
fn fund_increments_pool() {
    let env = Env::default();
    env.mock_all_auths();
    let verifier = Address::generate(&env);
    let funder = Address::generate(&env);
    let contract_id = env.register(ConfidentialPayroll, (verifier,));
    let client = ConfidentialPayrollClient::new(&env, &contract_id);

    client.fund(&funder, &20_000i128);
    assert_eq!(client.pool(), 20_000);
}

// End-to-end run_payroll (cross-call into the real BN254 host-function verifier, parsing
// ciphertexts + total from attested public inputs) is exercised on testnet - see
// docs/e2e-result.md. testutils does not register the external verifier wasm here.
