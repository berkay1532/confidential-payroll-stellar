# Screenshots

Captured headless (Playwright/Chromium) against the live testnet contract.

| File | What it shows |
|---|---|
| `desktop-employer.png` | Employer view — live pool/custody, fund + run-payroll, and the **on-chain encrypted ledger** (everyone sees only ElGamal ciphertext). |
| `desktop-auditor-decrypted.png` | Auditor view after **Decrypt with viewing keys** — per-employee real amounts (3,200 / 3,100 / 5,000 / 2,750) + provable total. Selective disclosure. |
| `mobile-employer.png` | Mobile-responsive employer view. |
| `mobile-employee.png` | Mobile employee view — ciphertext vs **decrypted-with-your-key** balance (3,200 USDC). |

The contrast between `desktop-employer` (gibberish on-chain) and `desktop-auditor-decrypted`
(real amounts, only with keys) is the core privacy story.
