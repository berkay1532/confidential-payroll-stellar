# Architecture — Confidential Payroll on Stellar

## 1. What is hidden vs public

| Visible on-chain | Hidden |
|---|---|
| That a payroll run happened | Individual salary amounts |
| Encrypted balance ciphertexts (opaque) | Per-employee balance |
| The Groth16/UltraHonk proof | Total payroll (except to the auditor) |
| Recipient addresses (optional to hide) | The distribution of amounts |

**Model:** encrypted-balance (confidential token), *not* a shielded pool. In payroll the parties are persistent and known (employer ↔ employee); what must be hidden is the **amounts**, not identities. This "addresses public / amounts private" shape fits payroll exactly, and is ZK-native (vs threshold-encryption approaches).

## 2. Crypto core

- **Encrypted balance:** Twisted **ElGamal over Baby Jubjub** (BN254's embedded curve), linearly homomorphic — encrypted add/subtract.
- **Validity:** ZK proof (Noir → UltraHonk/BN254) verified on-chain via native BN254 host functions (X-Ray, CAP-0074).
- **Range proofs:** in-circuit bit decomposition (amounts bounded to ≤ 2^40 so ElGamal decryption via baby-step-giant-step stays cheap).
- **Hash (Merkle/commitments):** Poseidon (native host function, CAP-0075).

## 3. Key design principle — the contract does NO EC math on balances

The contract stores ciphertexts as **opaque bytes**. The prover submits `(old_ct, new_ct, proof)`; the circuit proves `new_ct = old_ct − Σ(valid amounts)`. The contract simply: load `old_ct` → check it matches the proof's public input → **verify proof** → store `new_ct`. This sidesteps the curve-cycle problem: all EC/encryption math lives in the circuit (off-chain proving); on-chain is a single proof verification.

## 4. Contracts (verification-gateway + policy/proof split)

- **Verifier** — pure proof verification (UltraHonk/BN254). Narrow audit surface, reusable.
- **ConfidentialPayroll** — `address → ciphertext` map, batch processing, nonce/replay set, pay-period registry.
- **Policy/Compliance** — view-key registry, auditor disclosure, optional KYC allow-list, limits.
- **SAC bridge** — wrap/unwrap public USDC ⇄ confidential balance.

## 5. Circuits

### Batch circuit (core)
- **Public inputs:** employer old/new encrypted balance, N recipients' encrypted-amount ciphertexts, period nonce.
- **Private inputs:** individual plaintext amounts, employer plaintext balance, randomness.
- **Proves:** (1) `Σ amounts = old − new` (conservation); (2) each `amount ∈ [0, 2^40]` (range); (3) `old ≥ Σ amounts` (no overdraft); (4) each ciphertext correctly encrypts its amount under the recipient's pubkey.

### Withdraw circuit
Employee proves `balance ≥ amount` → unwrap to public USDC (amount visible only at the off-ramp boundary).

### Audit/total circuit (optional)
Employer proves `total disbursed this period = T` without revealing the split (alternative to sharing a view key).

## 6. Flows

1. **Onboarding** — employee registers encryption pubkey (+ optional viewing key).
2. **Funding** — employer wraps public USDC → confidential employer balance (amount public only at this boundary).
3. **Payroll run** — employer computes amounts off-chain, generates **one batch proof** client-side, submits one tx → contract verifies → updates all encrypted balances atomically. Amounts never appear on-chain.
4. **Withdrawal** — employee proves `balance ≥ amount`, unwraps to public USDC.
5. **Audit** — employer shares a viewing key (read-only, never spend) or submits a total-proof; auditor verifies totals match the books.

## 7. Security checklist

- **Anti-replay:** bind every proof to `(employer address, period nonce, action type)`.
- **Domain separation:** distinct statement domains for payroll / withdraw / audit.
- **Verifier isolated**, policy separate → safe upgrades, clean incident response.
- **Bounded workload:** fixed/capped N → no DoS, predictable proof cost.
- **Negative-path tests:** tampered ciphertext, stale nonce, overdraft attempt, malformed batch, unauthorized view-key access.

## 8. Known constraints

- One on-chain proof verification per payroll tx (a SNARK verify is a meaningful share of the per-tx instruction budget) → the design does exactly one batch proof per run.
- Constraint count scales with N → cap N (e.g. 8–16) for the demo; document the cap (no silent truncation).
- BN254 + Poseidon require Protocol ≥ 25 — verify the target network/SDK before relying on them.
