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
