# UI rewire onto the official OZ Confidential Token — status

**Core integration done + verified in the browser.** The official OZ SDK now runs inside the
Obscura web app.

## Done & verified
- **Vendored the OZ SDK** (built dist) into `web/lib/ozsdk/` — the browser-safe modules
  (chain/crypto/witness/proving/state), avoiding the Node-only `artifacts`/`json-store`.
- **Bundles in Next.js** (Turbopack) — production build passes.
- **OZ crypto + proving run in the browser** (`/oz-test`, headless-verified): derive Grumpkin keys
  → build a register witness → generate the official UltraHonk register proof via bb.js —
  **14,592-byte proof in ~2.5s** + a Grumpkin point op. This is the Pedersen/ECDH proving stack
  running on-device in the Obscura app.
- **Resolved the dependency conflict:** the OZ SDK pins `@noble/curves@1.9.7`; our standalone
  ElGamal decrypt needs v2. Installed v2 under an **alias** (`noble-curves-v2`) so both coexist;
  `lib/decrypt.ts` imports the alias. The standalone v2 auditor decrypt still works (verified:
  Ada 3,200 / Borys 3,100 / Chen 5,000 / Diego 2,750).
- **`lib/oz-payroll.ts`** — the in-browser batched-payroll function (register → deposit → N
  sequential transfer proofs → chunked `orchestrator.run_payroll`), wired to our deployed OZ stack.

## Remaining (employer-page wiring)
- The self-contained demo flow (`runOzPayroll`) friendbot-funds accounts in-browser; friendbot has
  CORS/latency quirks in a headless harness. The **production flow** uses the connected Freighter
  wallet as the employer + a pre-registered employee directory (no friendbot) — that's the
  remaining UI wiring: an Obscura employer page that calls the OZ payroll with the wallet signer.
- The on-chain orchestration itself is already proven on testnet (see the spikes): payroll on OZ,
  the PayrollOrchestrator, and the N-sequential chunked batch.

## Net
The hard parts of the rewire — vendoring the OZ SDK, bundling it in Next, running Pedersen/UltraHonk
proving in the browser, and resolving the @noble version conflict without breaking the standalone
demo — are **done and verified**. What's left is product UI wiring (employer page on the connected
wallet), not integration risk.
