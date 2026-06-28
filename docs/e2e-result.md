# End-to-end: ConfidentialPayroll + verifier gateway — working on testnet ✅

**Date:** 2026-06-28 · **Network:** Stellar testnet

Full flow verified: a Noir batch proof gates an on-chain payroll run via a cross-contract
call into the BN254 host-function UltraHonk verifier.

## Deployed contracts (testnet)
| Contract | Address |
|---|---|
| `ConfidentialPayroll` | `CB5EG5LOSXZ5NFQ6NPWVN4JWU5CMGKQNEM7IDN3XUBZEHOBHNHE3AHYF` |
| UltraHonk verifier (batch VK) | `CCNKYJVGKAXN4BDBRMU7UL54ZD4VNQOFOGZBAXXRVMDK5Q3A3VSW7QZ2` |

## What was proven
| Check | Result |
|---|---|
| `run_payroll` with valid batch proof | ✅ verified + stored 4 ciphertexts + event `payroll=4` (tx `9cc4810653fac03cd49d24e7f867f3bf04db0bb2c52e5238d3853930def957dd`) |
| `balance_of(0)` | ✅ returns stored ciphertext `aa11` |
| Replay (same period nonce) | ✅ rejected — `ReplayedNonce` (#3) |
| Tampered proof (fresh nonce) | ✅ cross-call to `verify_proof` traps → whole `run_payroll` reverts (`Error(Contract, #4)` "contract call failed, verify_proof") |

Cost of a valid `run_payroll` (verify + storage + tx): ~560k stroops (~0.056 XLM).

## Architecture confirmed
`ConfidentialPayroll.run_payroll` → `require_auth(employer)` → replay guard →
**cross-contract `verify_proof(public_inputs, proof)`** (traps on invalid) → store encrypted
balances (opaque bytes) → emit event. The payroll contract does NO EC math; all correctness
is proven inside the Noir circuit. This is the verifier-gateway + policy/proof split from
docs/architecture.md, now live.

## Next
- Bind stored `new_cts` to the proof's public outputs (currently stored as provided).
- Employer confidential balance + overdraft proof; SAC wrap/unwrap (USDC on/off-ramp).
- Withdraw circuit + flow; auditor view-key disclosure.
- Frontend (employer / employee / auditor) + self-serve demo-org onboarding.

---

## Increment A — conservation + integrity (2026-06-28)

`ConfidentialPayroll` now derives the total and the per-recipient ciphertexts **from the
verifier-attested `public_inputs`** (no unchecked args), and conserves the revealed total
against a funded pool.

Deployed (pool model): `CDZPVZTMVTXSMFOZH4GYCXISVBOI2FSJZZVK6SXGPYGJKHS452C5WYDM`

| Check | Result |
|---|---|
| `fund(20000)` → `pool()` | ✅ 20000 |
| `run_payroll` (valid) → event `payroll=(4, 15050)` | ✅ |
| `pool()` after payroll | ✅ 4950 (20000 − 15050 conserved) |
| **Integrity:** `balance_of(0)` == `public_inputs[64..192]` | ✅ exact match (ciphertext bound to proof) |
| **Conservation guard:** pool < total | ✅ `InsufficientPool` (#5) |
| Replay / tampered proof | ✅ (rejected / reverts — see above) |

Privacy model (this increment): individual salaries hidden inside ElGamal ciphertexts;
aggregate total revealed (auditor-visible) and conserved. Funding is mock (integer pool);
real USDC via SAC is the next increment.

---

## Increment B — real USDC via SAC (2026-06-28)

`fund` now pulls real tokens from the employer into the contract via the Stellar Asset
Contract; `pool` tracks available-to-distribute, `custody` is the actual token balance held.

- Test USDC SAC: `CAGB4O4Q6D4EPE3MLXA32MVSESGIA5JR2NUXGJUB3LZCEXSAJDB23WEC`
- ConfidentialPayroll (verifier + USDC): `CDZGKDZSKRZHB7D6TRN5VTETOM4T4FVBUQBRVYYP4LEWFKD7DQF4ZQPT`

| Step | Result |
|---|---|
| employer USDC before | 1,000,000 |
| `fund(20000)` pulls real USDC | ✅ employer → 980,000 ; `custody()` = 20,000 |
| `run_payroll` (total 15,050) | ✅ `pool()` 20,000 → 4,950 (committed to employees) |
| tokens stay in custody until withdraw | ✅ `custody()` = 20,000 |

Money loop so far: real USDC in → confidential distribution (salaries hidden) → tokens held
in custody. Next increment: **withdraw** — employees claim their hidden salary as real USDC.

---

## Increment C — withdraw (money loop closed) (2026-06-28)

Employees withdraw a revealed amount from their confidential balance, proving in ZK:
ownership (knows sk, bal with `C2 = bal*G + sk*C1`), solvency (`0 <= w <= bal`), and a
correctly-formed new balance ciphertext `C' = ElGamal(bal-w)`. The contract verifies the
withdraw proof, checks the proof's old ciphertext equals the stored balance, updates the
balance, and pays out real USDC.

- Withdraw circuit: 7,164 gates, public inputs 288 bytes (9 fields: old C | w | new C').
- Withdraw verifier: `CD7NUAGWFAJRX6ZMSTDTJ6JBZ2BQIUKHXP7WMJDKUT5SMICOYC5U37CE`
- Full ConfidentialPayroll (batch + withdraw verifiers + USDC): `CDIN5OI4IUEECZOYAR3KWIWDVGPBJK6V4CRUW6W54OWMRGSZHUYNLVFY`

| Step | Result |
|---|---|
| balance_of(0) after payroll | `2355ba1f…` (encrypts 4200) |
| `withdraw(index 0, w=1000)` | ✅ proof verified, integrity check passed |
| employee USDC | ✅ 960,000 → **961,000** (real USDC paid out) |
| `custody()` | ✅ 20,000 → **19,000** |
| balance_of(0) after withdraw | ✅ `1e66dd37…` — **new ciphertext** (encrypts 3200 = 4200−1000) |

## Money loop COMPLETE
`fund` (real USDC in) → `run_payroll` (confidential batch distribution, salaries hidden,
total conserved) → `withdraw` (ZK ownership proof, real USDC out, balance homomorphically
reduced). All verified on Stellar testnet with the BN254 host-function UltraHonk verifier.

Remaining (optional polish): bind employer confidential balance + overdraft proof, auditor
view-key disclosure (mostly client-side), frontend.
