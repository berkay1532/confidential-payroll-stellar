#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn init_sets_verifier_once() {
    let env = Env::default();
    let contract_id = env.register(ConfidentialPayroll, ());
    let client = ConfidentialPayrollClient::new(&env, &contract_id);

    let verifier = Address::generate(&env);
    client.init(&verifier);

    // second init must fail
    let res = client.try_init(&verifier);
    assert!(res.is_err());
}

// TODO(spike Gate 1+): once the verifier is wired up, add:
//   - run_payroll happy path with a real proof
//   - replayed-nonce rejection
//   - invalid-proof rejection
//   - overdraft attempt rejection (proven false in-circuit)
