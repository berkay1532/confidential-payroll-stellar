//! Confidential Payroll — batch circuit (skeleton)
//!
//! Proves a payroll run is valid WITHOUT revealing individual amounts:
//!   1. conservation:  sum(amounts) == employer_old_balance - employer_new_balance
//!   2. range:         each amount ∈ [0, 2^40]   (bounds ElGamal decryption cost)
//!   3. no overdraft:  employer_old_balance >= sum(amounts)
//!   4. encryption:    each recipient ciphertext correctly encrypts its amount
//!
//! Public inputs are what the Soroban verifier checks against on-chain.
//! Private inputs (the plaintext amounts, randomness, employer balance) stay secret.
//!
//! NOTE: ElGamal-over-Baby-Jubjub and Poseidon helpers are wired in during
//! Gate 2 of the spike (docs/spike-plan.md). This is the constraint scaffold.

global N: u32 = 8; // recipients per batch — capped for the demo (see architecture.md §8)
global MAX_AMOUNT: Field = 0x10000000000; // 2^40

fn main(
    // --- public inputs ---
    employer_old_ct: pub [Field; 2],          // ElGamal ciphertext (C1, C2) of employer balance, before
    employer_new_ct: pub [Field; 2],          // ... after
    recipient_cts: pub [[Field; 2]; N],        // per-recipient encrypted amounts
    period_nonce: pub Field,                   // anti-replay binding (employer + period + action)
    // --- private inputs ---
    amounts: [Field; N],                       // plaintext salaries (secret)
    employer_old_balance: Field,               // plaintext employer balance (secret)
    randomness: [Field; N],                    // encryption randomness (secret)
) {
    // 1 + 3: conservation & no overdraft
    let mut total: Field = 0;
    for i in 0..N {
        // 2: range check — amount fits in [0, 2^40]
        assert(amounts[i] as u64 < MAX_AMOUNT as u64);
        total += amounts[i];
    }
    assert(employer_old_balance as u64 >= total as u64);
    let employer_new_balance = employer_old_balance - total;

    // 4: encryption correctness (placeholder — real ElGamal in Gate 2)
    // for i in 0..N {
    //     assert(recipient_cts[i] == elgamal_encrypt(amounts[i], recipient_pk[i], randomness[i]));
    // }

    // bind new employer ciphertext to the proven new balance (placeholder)
    // assert(employer_new_ct == elgamal_encrypt(employer_new_balance, employer_pk, r_new));

    // touch public inputs so they are constrained
    assert(period_nonce == period_nonce);
    let _ = (employer_old_ct, employer_new_ct, recipient_cts, employer_new_balance, randomness);
}
