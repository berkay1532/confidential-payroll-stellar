# web — Confidential Payroll frontend

Next.js + Tailwind (mobile-first). Scaffolded during the parallel product track (see `../docs/spike-plan.md`).

## Bootstrap

```bash
npx create-next-app@latest . --ts --tailwind --app --eslint
npm install @creit.tech/stellar-wallets-kit @stellar/stellar-sdk
```

## Planned surfaces

- **Employer** — onboard employees, fund, run confidential payroll, view encrypted ledger.
- **Employee** — see own salary (client-side decrypt), withdraw to USDC.
- **Auditor** — with a view key: verify totals without seeing the breakdown.

## Requirement hooks (Level 4)

- Mobile-responsive, proper loading/error states (proof-gen progress UI is mandatory — proving takes seconds).
- Self-serve **demo-org** onboarding → path to 10+ real-user wallet interactions.
- Analytics (PostHog/Plausible) + in-app feedback form.
