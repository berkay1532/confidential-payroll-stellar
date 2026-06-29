# Production item 2 — client-side proving

**Status: feasibility PROVEN end-to-end.** Browser-generatable proofs verify on-chain.

## The gap in the MVP
The demo submits *pre-generated* proof fixtures. A real product must generate a fresh proof
for the actual amounts, on the user's device, so secrets never leave the client.

## Spike result (Node, same WASM as the browser)
Using the versions that match our on-chain verifier — `@noir-lang/noir_js@1.0.0-beta.9` +
`@aztec/bb.js@0.87.0` (UltraHonk, keccak oracle):

```js
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

const noir = new Noir(circuit);                       // circuit = compiled .json
const { witness } = await noir.execute(inputs);       // amounts/rs/sks
const backend = new UltraHonkBackend(circuit.bytecode, { threads: 8 });
const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
```

| Metric | Result |
|---|---|
| Witness | 3,650 bytes |
| Proof generation time | **~0.9 s** (batch circuit, N=4) |
| Proof size | 14,592 bytes (identical to the CLI proof) |
| Public inputs | 25 fields (identical) |
| `backend.verifyProof` | ✅ true |
| **On-chain `verify_proof`** (deployed batch verifier) | ✅ **null/Ok** |

The browser-shaped proof **verifies against the live on-chain verifier** — definitive. Because
this is pure JS/WASM, it runs identically in the browser.

## Remaining integration (engineering, not feasibility)
1. Bundle `@aztec/bb.js` (WASM) + the compiled circuit JSON into the web app; run proving in a
   **Web Worker** so the UI stays responsive.
2. bb.js threading wants **cross-origin isolation** — serve with
   `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
   (Next.js `headers()` / `next.config`). Single-thread fallback works without it (slower).
3. Build the circuit `inputs` object from the actual payroll amounts + recipient keys; replace
   the `public/demo/*.bin` fixtures with on-device proving.
4. Show a proving progress state (sub-second to a few seconds depending on N and device).

Kept out of the live demo bundle for now to avoid destabilising the working app (bb.js WASM +
COOP/COEP headers are a deliberate, testable integration step) — but the path is proven.

## ✅ Wired into the app (2026-06-30)
`run_payroll` now generates the batch proof **in the browser** (`web/lib/prove.ts`,
`proveBatchInBrowser`) instead of loading a fixture: noir_js executes the witness from the
amounts + recipient keys, bb.js produces the UltraHonk proof (single-thread → no cross-origin
isolation headers needed), and it's submitted to the v2 contract. Verified headlessly in Chromium:
proof 14,592 bytes, public_inputs 800 bytes, **~2.4s**. The proof format is identical to the
on-chain-verified one from the Node spike. (Withdraw still uses a fixture this pass.)
