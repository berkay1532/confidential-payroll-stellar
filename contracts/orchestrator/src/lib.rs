#![no_std]
//! PayrollOrchestrator — Obscura's thin protocol layer over the official OZ Confidential Token.
//!
//! A confidential payroll run is a *batch* of the token's `confidential_transfer(from, to, data)`
//! calls executed atomically in one transaction, with payroll semantics (single employer auth,
//! anti-replay period nonce, a payroll event). Each `data` carries the recipient's transfer
//! witness + UltraHonk proof produced client-side; the orchestrator never sees plaintext amounts.
//!
//! All transfers debit the employer's confidential spendable balance and credit each employee's
//! receiving balance on the underlying confidential token. The employer authorizes the whole run
//! once (as tx source, its `require_auth` covers the nested transfers).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Bytes, BytesN,
    Env, IntoVal, Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Token,
    UsedNonce(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    ReplayedNonce = 2,
    LenMismatch = 3,
}

#[contract]
pub struct PayrollOrchestrator;

#[contractimpl]
impl PayrollOrchestrator {
    /// Wire the orchestrator to a confidential-token contract.
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Run a confidential payroll: one `confidential_transfer` per recipient, atomically.
    /// `datas[i]` is the OZ transfer envelope (witness + proof) for paying `recipients[i]`.
    pub fn run_payroll(
        env: Env,
        employer: Address,
        period_nonce: BytesN<32>,
        recipients: Vec<Address>,
        datas: Vec<Bytes>,
    ) -> Result<u32, Error> {
        employer.require_auth();
        if recipients.len() != datas.len() {
            return Err(Error::LenMismatch);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::UsedNonce(period_nonce.clone()))
        {
            return Err(Error::ReplayedNonce);
        }
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;
        let func = Symbol::new(&env, "confidential_transfer");

        let n = recipients.len();
        for i in 0..n {
            let to = recipients.get(i).unwrap();
            let data = datas.get(i).unwrap();
            let args = vec![
                &env,
                employer.clone().into_val(&env),
                to.into_val(&env),
                data.into_val(&env),
            ];
            env.invoke_contract::<()>(&token, &func, args);
        }

        env.storage()
            .persistent()
            .set(&DataKey::UsedNonce(period_nonce), &true);
        env.events().publish((symbol_short!("payroll"), employer), n);
        Ok(n)
    }

    pub fn token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Token)
    }
}

mod test;
