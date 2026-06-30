# Production push — decision log

Autonomous run toward a production-ready product. Every decision I made without asking is
recorded here for review.

## Brand

- **Name: Obscura.** Evokes *camera obscura* — you can verify the image without seeing the
  subject directly. That is exactly the product: totals are provable, individual salaries stay
  hidden. Short, premium, fintech-credible, distinct from the "pay/veil/hush" crowd.
- **Tagline: "Salaries private. Totals provable."**
- **One-liner:** Confidential payroll on Stellar — pay your team in stablecoins with
  individual salaries encrypted on-chain and aggregates auditable in zero-knowledge.
- **Voice:** precise, calm, trustworthy. Fintech rigor with a privacy edge. No hype.

## Visual system

- **Aesthetic:** near-black premium canvas; a single confident accent. Privacy products that
  also need *trust* read best as dark + restrained, not neon.
- **Accent: violet/indigo (`#7C6CF6`)** — signals cryptography + premium fintech; differentiates
  from the generic crypto-green. Used for primary actions and the brand mark.
- **Semantic color = the core idea:** `encrypted` state is muted/neutral (ciphertext is
  meaningless); `revealed` state (decrypted with a key) is **mint** (`#5EEAD4`). The color flip
  from neutral→mint *is* the selective-disclosure story.
- **Type:** Geist (already in app) — clean, technical, neutral. Tabular numerals for amounts.
- **Logo:** an aperture/eclipse mark — a ring with a partial occlusion (the "obscured" disc).

## Why not DesignSync-generated UI

`DesignSync` syncs a local component library *to* claude.ai/design for visual review; it doesn't
generate the app UI. So I build the production UI directly in the Next.js app with a documented
design system, and *also* publish a component gallery to the Obscura design project
(`3aa58f6f-4d34-42f7-9ba6-1ff0c35ef22e`) so the designs are reviewable on claude.ai/design.

## Engineering decisions (appended as I go)

(see entries below, newest last)

### UI rebrand → Obscura (done, verified)
- Rebuilt the Next.js app with the Obscura design system: dark canvas (#08080b), violet primary
  (#7C6CF6), mint (#5EEAD4) for the *revealed/decrypted* state. Added a hero/landing section with
  the "encrypted vs key-holder" two-frame story, eclipse logo mark, sticky header, polished app card.
- Tailwind v4 `@theme` tokens (canvas/surface/line/muted/violet/mint). Build passes; headless
  screenshots confirm desktop + mobile render correctly with live on-chain data.
- Kept all functionality identical (reads, fund/run_payroll/withdraw, client-side decrypt).

### Item 1: viewing key ≠ spending key (circuit done + verified)
- Implemented `circuits/withdraw_v2`: separates VIEWING key (decrypts, shareable with auditor)
  from SPENDING key (authorizes withdrawal). Balance encrypted under pk_view; withdrawal bound to
  pk_spend = sk_spend·G.
- Verified natively (7,799 gates, proof verifies) AND negatively: an attacker with only the
  viewing key fails the authorization constraint → can read but cannot spend. Security property holds.
- Full integration (contract stores pk_spend, batch encrypts under pk_view, v2 verifier deploy)
  is specified in docs/production/01-key-separation.md but staged to avoid destabilising the live
  demo. Decision: ship the verified circuit + design now; wire into a v2 contract as a deliberate
  follow-up rather than risk the working testnet stack mid-run.
- Also designed item 1b (hidden employer total) — documented, follow-up.

### Item 2: client-side proving (feasibility PROVEN)
- Spiked noir_js@1.0.0-beta.9 + bb.js@0.87.0 (keccak oracle) in Node: generated a batch proof in
  ~0.9s, identical format to the CLI proof, and it **verifies on-chain** against the deployed
  verifier. Pure JS/WASM → works in-browser.
- Decision: prove feasibility now (done, definitive), document the integration path (Web Worker +
  COOP/COEP headers), but keep bb.js WASM out of the live demo bundle this run — it's a deliberate
  testable integration step, and I can't browser-verify the full WASM/worker wiring headlessly.

### Contract tests (#12, done)
- Added 4 Soroban unit/integration tests with a MockVerifier: conservation (pool debited by the
  revealed total), integrity (stored ciphertexts equal the public-input slices), replay-nonce
  rejection, insufficient-pool guard, and invalid-proof revert (cross-call trap). All pass.

### Item 1 GO-LIVE: v2 contract deployed (viewing ≠ spending, on testnet)
- Built batch_v2 (encrypt under pk_view, publish pk_spend) + contract v2 (stores Owner=pk_spend,
  withdraw checks owner match + sk_spend proof). Deployed all three contracts; verified e2e:
  fund → run_payroll → withdraw (1,000 USDC out) → auditor decrypts with viewing keys.
- Switched the frontend to the v2 stack + viewing keys + v2 demo proofs. Contract tests updated for
  the v2 layout (4/4 pass). The old v1 stack remains deployed but the app now points at v2.

### Item 2 GO-LIVE: in-browser proving wired into the app
- `lib/prove.ts` generates the batch payroll proof on-device (noir_js + bb.js, single-thread to
  avoid SharedArrayBuffer / COOP-COEP — which would break the RPC/wallet calls). `run_payroll` now
  proves in-browser (~2.4s in Chromium), no batch fixture. Build passes; headless-verified.
- Kept single-thread deliberately (no cross-origin-isolation headers) so analytics/RPC/wallet keep
  working. Withdraw proving left on fixture this pass (needs live-balance decryption + fresh r).

### Align with the official Stellar Confidential Token (OZ + Nethermind)
- Stellar shipped a Confidential Tokens developer preview (OpenZeppelin contracts + Nethermind
  UltraHonk verifier). It matches what we built independently: **same curve (Grumpkin), same
  verifier repo+commit (rs-soroban-ultrahonk @ 661db07), same model** (amounts hidden, addresses
  visible, SEP-41/USDC wrapper, auditor keys, compliance policy).
- Decision: position Obscura as the **payroll vertical built on the official OZ Confidential
  Token** for production (payroll run = batched `confidential_transfer`s; auditor = OZ dual-auditor
  ECDH; compliance = OZ policy contract). Keep the standalone hackathon build as-is. Documented the
  full mapping + migration in `03-align-with-oz-confidential-token.md`; made it the headline
  production step. This aligns Obscura with the ecosystem's official, soon-to-be-audited primitive.

### Batch-transfer circuit — parked as a future OZ contribution
- A single proof for N transfers (vs OZ's per-transfer model, ~2/tx) would remove chunking and let
  a whole payroll settle in one tx — a real upstream contribution to OpenZeppelin/stellar-contracts
  (or an Obscura extension). Documented in `04-future-batch-transfer-circuit.md`.
- Decision: park it (new circuit = significant design + audit; OZ is still pre-audit). Proceed now
  with **chunking** (aligned with the official per-transfer docs) — already verified + scales.
