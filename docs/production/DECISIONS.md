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
