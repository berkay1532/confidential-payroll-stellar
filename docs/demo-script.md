# Demo script — Confidential Payroll on Stellar

A ~3-minute walkthrough that lands the "wow": **individual salaries are gibberish on-chain,
yet the system pays real USDC and stays auditable.** Record screen + voiceover.

## 0. Setup (before recording)
- Freighter on testnet, holding the **employer** key (`GBAO…7PWK`, recipient #0 = the demo employee too).
- App running (`npm run dev`) or the deployed URL.
- A second browser tab open on stellar.expert (testnet) for the contract.

## 1. The problem (15s)
> "Stablecoin payroll on a public chain leaks every salary. On Stellar, if I pay my team in
> USDC, anyone can read who earns what. That blocks real companies. We fix it with zero-knowledge."

Show the landing page tagline.

## 2. Employer funds the pool (25s)
- Tab: **Employer**. Click **Connect wallet** → Freighter → approve.
- Click **Fund 20,000 USDC** → sign. Watch `Available pool` and `In custody` update.
> "Real USDC goes into the payroll contract via the Stellar Asset Contract."

## 3. Run confidential payroll — the wow (40s)
- Click **Run confidential payroll** → sign.
- The **On-chain encrypted ledger** fills with 4 rows of ciphertext.
> "One transaction paid the whole team. Each row is an employee's salary — but it's an ElGamal
> ciphertext. Unreadable."
- Click a row's `…↗` → **stellar.expert** opens the contract. Show the stored entries are raw bytes.
> "This is what the public sees on-chain. No amounts. Verified live, not a slide."

## 4. Employee view — selective decryption (35s)
- Tab: **Employee** (you are Ada).
- Left card: **On-chain (everyone sees)** = the same gibberish.
- Right card: **Your view (decrypted with your key)** = **4,200 USDC**.
> "Only Ada, with her key, can decrypt her own balance. Same bytes — but she sees her salary."

## 5. Withdraw — ZK ownership + real money (35s)
- Click **Withdraw 1,000 USDC**.
> "To withdraw, Ada proves in zero-knowledge that she owns this balance and it covers the amount —
> without revealing the balance. The contract verifies the proof and pays real USDC."
- Sign. Show the success toast + **view tx ↗**. Her view drops to 3,200; custody drops by 1,000.

## 6. Auditor view — compliance + selective disclosure (35s)
- Tab: **Auditor**.
- Show the **provable total** (15,050 USDC), conserved against the pool.
> "An auditor sees the aggregate is correct and conserved — without seeing a single salary."
- Click **Decrypt with viewing keys**. The per-employee rows flip from ciphertext to real amounts.
> "Now, given the employees' viewing keys, the auditor decrypts each balance client-side — live,
> from the real on-chain ciphertext. The public still sees only gibberish. Privacy and compliance,
> together."
- (Note: in this MVP the viewing key equals the spending key; production separates them.)

## 7. Close (15s)
> "Confidential payroll on Stellar. Real USDC in, salaries hidden on-chain, ZK ownership to cash
> out, auditable totals. Built on Soroban with the BN254 host-function UltraHonk verifier and
> Noir circuits — all live on testnet."
- Show the footer contract link.

## Key on-screen proofs to capture
- The encrypted ledger (4 ciphertext rows).
- stellar.expert contract page showing raw stored bytes.
- The employee side-by-side: ciphertext vs decrypted 4,200.
- A withdraw tx on stellar.expert (real USDC transfer event).
- The auditor total.

## Talking points if asked
- Verifier is the updated `rs-soroban-ultrahonk@661db07` (native BN254 host functions, ~constant
  ~125k-stroop verification — see docs/gate2-result.md).
- Conservation + integrity enforced on-chain (docs/e2e-result.md): ciphertexts are parsed from the
  verifier-attested public inputs, total debited from a funded pool.
- Current demo uses pre-generated proofs; in-browser Noir proving is the next step.
