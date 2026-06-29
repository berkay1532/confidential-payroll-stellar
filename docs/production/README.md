# Obscura — production readiness

Honest gap analysis from working hackathon MVP → production product, with what's already done
this push and what remains. Live demo is on Stellar testnet; full money loop works.

## ✅ Done & verified this push
| Item | Evidence |
|---|---|
| **Brand: Obscura** + production UI (hero, design system, mobile) | `docs/screenshots/obscura-*.png`, design project on claude.ai/design |
| **Item 1 — viewing key ≠ spending key** (circuit + security property) | `01-key-separation.md`; native verify + negative test (viewing-only key can't spend) |
| **Item 2 — client-side proving** (feasibility) | `02-client-side-proving.md`; browser-shaped proof (~0.9s) verifies on-chain |
| Contract integration tests (mock verifier) | `contracts/payroll/src/test.rs` — conservation, integrity, replay, gating |
| Analytics + feedback | Plausible + in-app widget |

## 🔴 Critical path to production (remaining)
1. ~~Wire item 1 into a v2 contract~~ ✅ **DONE & LIVE** — v2 stack deployed; viewing≠spending
   verified end-to-end on testnet (see `01-key-separation.md`).
2. **Hide the employer total** (item 1b) — encrypt the pool balance; conservation proven
   in-circuit. (Designed.)
3. **Wire item 2 into the app** — bb.js WASM in a Web Worker + COOP/COEP headers; prove on-device
   from real amounts. (Proven feasible.)
4. **Security audit** — Soroban contracts + Noir circuits (independent).
5. **Verifier dependency** — `rs-soroban-ultrahonk` is community/WIP + unaudited; track its audit
   + stability, or vendor a hardened fork.

## 🟡 Core product (for a real launch)
- Key management & recovery (employees hold view+spend keys; auditors receive view keys).
- Real USDC (Circle, mainnet) + anchor on/off-ramp (SEP-24/6).
- Soroban storage TTL management (bump persistent entries so balances don't archive).
- KYC/AML + ASP-style allow-lists (sanctioned-address screening).
- Backend/indexer (org + employee directory, encrypted metadata, notifications).
- Recurring/scheduled payroll, multiple orgs, larger batch N + proving perf.

## 🟢 Scale & polish (post-launch)
- Passkey smart-account onboarding, mobile apps, i18n, a11y.
- Production infra: monitoring, error tracking, RPC reliability, KMS/HSM key infra.
- Efficient decryption (BSGS + precomputed tables).

## ⚖️ Non-technical (often the hardest)
- Money-transmission licensing, **payroll tax compliance**, jurisdiction.
- Tax reporting integration; fund custody + insurance; legal entity; GTM/pilots.

## Rough timeline (capable team)
- Core (1–3): ~2–3 months · usable pilot (1–5): ~6 months · full production incl. regulation:
  9–12 months+.

## Stance
The MVP is an end-to-end, on-chain, ZK-verified product with a real UI — strong for a hackathon
and a credible foundation. Production is a different game; the biggest risks are hardening the
crypto (keys + hidden totals), the unaudited verifier dependency, and legal/regulatory. The two
highest-leverage technical items (key separation, client-side proving) are now **proven** rather
than assumed.
