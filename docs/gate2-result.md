# Gate 2/3 result — crypto core: ✅ provable, ❌ UltraHonk on-chain verification does NOT scale

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
