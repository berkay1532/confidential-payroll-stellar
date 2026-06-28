# Gate 1 result — Noir → Soroban verifier path: ✅ GREEN

**Date:** 2026-06-28 · **Network:** Stellar testnet (Protocol 27)

The riskiest assumption of our stack — that the **Noir (UltraHonk) → Soroban (BN254) verifier** path works end-to-end on-chain — is **proven**.

## Evidence

| Item | Value |
|---|---|
| Verifier contract (testnet) | `CAFUVIDW5X5UY4JPPDN3YH2BARHSFSARF7UNH5HYU6SWUEO64YIVFF4O` |
| Deploy tx | `eb60e7298690a1f20215fdb85cad187ac0b6962fd2202d644af990a3b9bc2499` |
| **Valid proof → verified on-chain** | tx `9dae38c446f57c9f173c4d5708448a64e78f8a34c1cc1f43f0df9b25553576f0` → returns `void`/`Ok` |
| **Invalid proof → rejected** | `Error(Contract, #3)` = `VerificationFailed` (negative test passed) |
| Cost per verification | Resource fee ≈ 358k stroops; fee charged ≈ 343,805 stroops (~0.034 XLM) |

Both directions confirmed: a valid proof verifies, a mismatched proof is rejected → the verifier is genuinely verifying (not a no-op).

## ⚠️ Critical finding — the path is VERSION-PINNED

The latest Noir/bb (nargo `1.0.0-beta.22` / bb `5.0-nightly`) proof format is **incompatible** with this verifier. You MUST pin:

| Tool | Pinned version |
|---|---|
| nargo (Noir) | `1.0.0-beta.9` |
| bb (Barretenberg) | `v0.87.0` |
| bb prove/write_vk flags | `--scheme ultra_honk --oracle_hash keccak --output_format bytes_and_fields` |
| Verifier contract | [`indextree/ultrahonk_soroban_contract`](https://github.com/indextree/ultrahonk_soroban_contract) |
| Rust verifier lib | `yugocabrio/ultrahonk-rust-verifier` |
| soroban-sdk | rev `acffbbd…` (25.0.0-rc.2), built with BN254 host functions (X-Ray) |

Using the latest toolchain silently produces proofs the contract can't parse. This is exactly the "experimental / version-sensitive" risk we flagged — now de-risked with known-good versions.

## Reproduce

```bash
# pinned toolchain
noirup -v 1.0.0-beta.9
# bb v0.87.0 darwin-arm64 → ~/.bb087/bb (see tests/build_circuits.sh in upstream)

git clone https://github.com/indextree/ultrahonk_soroban_contract.git
cd ultrahonk_soroban_contract
# add `overflow-checks = true` to [profile.release] for stellar-cli >= 26
bash tests/build_circuits.sh                       # generate vk/proof/public_inputs
rustup target add wasm32v1-none
stellar contract build
stellar keys generate spike --network testnet --fund
stellar contract deploy --wasm target/wasm32v1-none/release/ultrahonk_soroban_contract.wasm \
  --source spike --network testnet -- --vk_bytes-file-path tests/simple_circuit/target/vk
stellar contract invoke --id <ID> --source spike --network testnet --send=yes -- \
  verify_proof --public_inputs-file-path tests/simple_circuit/target/public_inputs \
  --proof_bytes-file-path tests/simple_circuit/target/proof
```

## Implication for the build

- **Proceed with Noir + Soroban** (no fallback to Circom needed — Gate 1 passed).
- Pin the toolchain repo-wide; document it for the whole team.
- The upstream repo ships a `tornado_classic` (Noir + Soroban privacy mixer) example — a close sibling of our confidential-payroll flow and a useful reference for the batch circuit + verifier integration.
- Next: Gate 2 (Baby Jubjub ElGamal + range proof + Poseidon in a Noir circuit).
