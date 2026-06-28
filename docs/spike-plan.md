# Spike plan — de-risk before full build (≈72h)

Goal: prove the **riskiest assumptions** of the Noir + Soroban path *before* committing the full team. Each gate is binary: green → proceed, red → fix or fall back.

## Gate 1 — Noir → Soroban verifier path (HIGHEST RISK on this stack) — ✅ GREEN (2026-06-28)
The Noir → Soroban (UltraHonk/BN254) verifier pipeline is newer/experimental. Prove it works before anything else.

> **Result:** PASSED on testnet — valid proof verifies, invalid proof rejected. See [`gate1-result.md`](gate1-result.md). Key finding: the path is **version-pinned** (nargo `1.0.0-beta.9` + bb `v0.87.0`); the latest toolchain is incompatible.

- [ ] Install Noir (`noirup`) + the backend (Barretenberg/UltraHonk).
- [ ] Write a trivial Noir circuit (e.g. prove `a * b == c`).
- [ ] Generate a proof + verification key.
- [ ] Deploy the UltraHonk/BN254 verifier contract to Stellar **testnet**.
- [ ] Verify the proof **on-chain** end-to-end.

**Green:** on-chain verification succeeds and fits the instruction budget. **Red:** fall back to Circom + BN254 Groth16 (mature path) — same BN254 host functions, more ready libraries.

## Gate 2 — Confidential primitives in Noir — ✅ GREEN (2026-06-28)
- [ ] Baby Jubjub ElGamal encryption in a Noir circuit (1 recipient).
- [ ] One range proof (`amount ∈ [0, 2^40]`).
- [ ] Poseidon hash usage.

**Green:** circuit compiles and proves locally. **Red:** assess library gaps; port from circomlib / consider Circom fallback.

## Gate 3 — Scale & budget — ✅ GREEN (host-fn verifier, ~constant cost)
- [ ] Measure constraint count for N=1 recipient; extrapolate to N=8 and N=16.
- [ ] Confirm proving time is acceptable client-side (target: a few seconds to low tens of seconds).
- [ ] Confirm one on-chain batch verification fits the per-tx instruction budget.

**Green:** N=16 is feasible → full build. **Red:** cap N lower, or split into sub-batches (document the cap).

## Guaranteed-shippable fallback (if any gate stays red)
- N=1 per proof (pay salaries one at a time), or small fixed N.
- Commitment + encrypted-note model (simpler circuit) instead of full ElGamal.
- Single demo-org, view-key auditor.

This always ships a working confidential payroll demo → removes hackathon delivery risk.

## Parallel track (does not wait on the spike)
While the ZK spike runs, the product team starts:
- Next.js app shell, mobile-first layout, wallet connect (Stellar Wallets Kit / passkeys).
- Self-serve "demo-org" onboarding flow (this is how we reach the 10-real-user requirement).
- Analytics (PostHog/Plausible) + feedback form wiring.
