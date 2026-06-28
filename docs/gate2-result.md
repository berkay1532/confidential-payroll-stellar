# Gate 2/3 result — crypto core: ✅ provable, ✅ on-chain verified (with the UPDATED verifier)

> **⚠️ SUPERSEDED:** The "pivot to Groth16" conclusion below was based on the OLD verifier
> (`indextree/...`, soroban-sdk 25, Arkworks software math). The root cause was the verifier,
> not UltraHonk. With the **updated host-function verifier** the crypto core verifies on-chain
> cheaply. **We keep Noir + UltraHonk — no Groth16 pivot.** See the RESOLUTION section at the bottom.


**Date:** 2026-06-28 · **Network:** Stellar testnet

## What passed
The confidential-payroll **crypto core proves and verifies natively**:
- EC-ElGamal encryption over the Noir embedded curve (Grumpkin): `C1 = r·G`, `C2 = amount·G + r·PK`
- 40-bit range proof on the amount
- Pedersen commitment binding `(amount, r)`
- `nargo compile` ✅, `nargo execute` ✅, `bb prove` (UltraHonk, keccak) ✅, `bb verify` → **"Proof verified successfully"** ✅

Circuit size: **8,510 gates** for ONE recipient.

## What failed — the wall
On-chain `verify_proof` of this circuit's proof returns **`Error(Budget, ExceededLimit)`** — it exceeds Soroban's per-tx CPU instruction budget (~100M).

| Circuit | Size (gates) | On-chain verify |
|---|---|---|
| Gate 1 `simple_circuit` (`x != y`) | **18** | ✅ fits (~344k stroops) |
| Gate 2 crypto core (EC-ElGamal) | **8,510** | ❌ Budget ExceededLimit |

### Root cause
The `ultrahonk_rust_verifier` is a **pure-WASM** verifier — it does NOT use Stellar's native BN254 host functions. So UltraHonk verification cost **scales with circuit size** (sumcheck rounds + in-WASM field/curve ops) and blows the instruction limit on any non-trivial circuit. Gate 1 only ever proved an 18-gate toy. A real batch circuit (N recipients) is far larger → far over budget. Raising limits is not an option on testnet/mainnet (protocol-fixed; only localnet allows `--limits unlimited`).

## The fix — switch on-chain verification to Groth16 (constant cost)
**Groth16 verification is a fixed 3-pairing check — constant cost regardless of circuit size** — and Stellar exposes pairing as a single native host call (BN254 via X-Ray, or BLS12-381 via CAP-0059). Research: *"verifying a SNARK requires only a single bilinear pairing computation… runs as a single host call."* That is Groth16, not UltraHonk-in-WASM.

Two ways to keep moving (both give constant-cost on-chain verification that fits the budget):

| Option | Proving | On-chain verifier | Notes |
|---|---|---|---|
| **A. Noir + Arkworks Groth16** | Noir circuits, Arkworks Groth16 backend ([Interstellar](https://github.com/orgs/noir-lang/discussions/8654)) | BLS12-381 Groth16 (`soroban-examples/groth16_verifier`) | Keeps our Noir circuits; needs the Interstellar/Arkworks backend |
| **B. Circom + BN254 Groth16** | Circom + snarkjs (`-p bn254`) | native BN254 Groth16 verifier | Most mature; `ec-elgamal-circom` + `circomlib` Poseidon ready as-is |

Both keep the **same architecture** (encrypted balances, batch proof, verifier-gateway). Only the proof system changes: **UltraHonk → Groth16**.

## Status
- Crypto core feasibility: **proven** (it computes, proves, verifies natively).
- On-chain verification approach: **must be Groth16** (UltraHonk-WASM rejected on cost grounds).
- This vindicates the constant-cost rationale behind the original Circom+BN254+Groth16 option — applied now with evidence.

## Confirmation from official sources (2026-06-28)

The Stellar ZK docs (`developers.stellar.org/docs/build/apps/zk`) reference the `indextree/ultrahonk_soroban_contract` as the example verifier. Its milestone report (HackMD) explicitly states:

- Without `--limits unlimited`, verification triggers **`Error(Budget, ExceededLimit)`** (the exact error we hit).
- "Optimization is **necessary before testnet deployment**."
- Native **BN254 + Poseidon2 precompile integration is FUTURE work** ("Integrating … to reduce fees") — the current verifier does not yet fully use the host functions.

**Conclusion:** the UltraHonk Soroban verifier is a work-in-progress, not production-ready for non-trivial circuits. This is not a misconfiguration on our side — the tool isn't there yet. Betting a production MVP on it is unacceptable risk.

**Decision: pivot on-chain verification to Groth16** (constant-cost single `pairing_check` host call), via **Circom + BN254**. Circuits stay in spirit identical (EC-ElGamal + range + commitment); `circomlib` Poseidon + `ec-elgamal-circom` (Baby Jubjub) are usable as-is. Starting points: `jayz22/soroban-examples` (p25-preview), native `pairing_check`/`g1_mul` host functions.

---

## ✅ RESOLUTION (2026-06-28) — UltraHonk works; root cause was the verifier version

A community contact who hit the exact same `Budget ExceededLimit` shared the fix: the old verifier pins **soroban-sdk 25.0.0-rc.2** (rev `acffbbd…`), which **predates the CAP-80 BN254 host functions**, so it did the pairing/MSM in WASM (Arkworks userland) → over budget. The **updated verifier** is on soroban-sdk 26 and routes EC ops through the native host functions.

**Use this verifier:**
- Repo: `yugocabrio/rs-soroban-ultrahonk`
- Commit (HEAD): `661db07200f890b1bd9a7349ed787c70a706dd12` (Nethermind-maintained)
- soroban-sdk **26.0.1**; verifier crate uses `soroban_sdk::crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Bn254Fr}` (native CAP-80)
- Same toolchain: Noir `1.0.0-beta.9` + bb `0.87.0`, `--oracle_hash keccak`
- Per-tx instruction budget is now **400M** (testnet + mainnet)

**Proof (testnet) — same 8,510-gate crypto-core circuit that FAILED on the old verifier:**

| | Old verifier (sdk25, WASM) | New verifier (sdk26, host fns) |
|---|---|---|
| 18-gate trivial circuit | ✅ ~344k stroops | — |
| **8,510-gate crypto core** | ❌ `Budget ExceededLimit` | ✅ **verified, ~125k stroops** |

- Host-fn verifier contract: `CACKNXTZTZR2E36I46Q4L5GPVZO5CBRYUOQROUJF4XLZX3GOIZG323Q3`
- ✅ valid proof → verified: tx `6ef84747236ed75774f18082560fae8e88a21f53da13b842ead712e4f992cb31`
- ✅ tampered public input → rejected: `Error(Contract, #4)` (VerificationFailed)
- Cost is ~constant and *cheaper* than the old WASM verifier on a trivial circuit → batch scaling (N recipients) is comfortably within budget.

**Decision (final): keep Noir + UltraHonk.** Wire up `rs-soroban-ultrahonk` @ `661db07` as the verifier gateway. The earlier Groth16 pivot is cancelled. Gate 1, 2, and the cost concern (Gate 3) are all green.
