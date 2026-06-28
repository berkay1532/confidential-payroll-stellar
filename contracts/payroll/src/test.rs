#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn constructor_wires_verifier_and_balance_starts_empty() {
    let env = Env::default();
    let verifier = Address::generate(&env);
    let contract_id = env.register(ConfidentialPayroll, (verifier.clone(),));
    let client = ConfidentialPayrollClient::new(&env, &contract_id);

    assert_eq!(client.verifier(), Some(verifier));
    assert_eq!(client.balance_of(&0u32), None);
}

// End-to-end run_payroll (cross-contract call into the real BN254 host-function verifier)
// is exercised on testnet via scripts/e2e — see docs/batch-circuit-result.md. testutils does
// not register the external verifier wasm here.
