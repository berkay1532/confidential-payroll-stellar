#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env};

fn setup(env: &Env) -> (Address, Address) {
    let verifier = Address::generate(env);
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin);
    (verifier, sac.address())
}

#[test]
fn constructor_wires_verifier_token_pool_empty() {
    let env = Env::default();
    let (verifier, token) = setup(&env);
    let id = env.register(ConfidentialPayroll, (verifier.clone(), token.clone()));
    let client = ConfidentialPayrollClient::new(&env, &id);

    assert_eq!(client.verifier(), Some(verifier));
    assert_eq!(client.token(), Some(token));
    assert_eq!(client.pool(), 0);
    assert_eq!(client.balance_of(&0u32), None);
}

#[test]
fn fund_pulls_real_tokens_and_credits_pool() {
    let env = Env::default();
    env.mock_all_auths();
    let verifier = Address::generate(&env);
    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin);
    let token_addr = sac.address();

    let employer = Address::generate(&env);
    token::StellarAssetClient::new(&env, &token_addr).mint(&employer, &50_000i128);

    let id = env.register(ConfidentialPayroll, (verifier, token_addr.clone()));
    let client = ConfidentialPayrollClient::new(&env, &id);

    client.fund(&employer, &20_000i128);
    assert_eq!(client.pool(), 20_000);
    assert_eq!(client.custody(), 20_000); // contract really holds the tokens
    assert_eq!(
        token::TokenClient::new(&env, &token_addr).balance(&employer),
        30_000
    ); // pulled from employer
}
