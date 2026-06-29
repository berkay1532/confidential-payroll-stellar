# Production item 1 — viewing key ≠ spending key

**Status:** circuit implemented + verified (Node/bb). Contract integration specified below.

## The flaw in the MVP
In the hackathon MVP the *viewing key equals the spending key* (`sk`). Sharing it with an
auditor for selective disclosure would also hand over withdrawal authority. Unacceptable for
production.

## The fix
Each employee holds **two** keypairs:

| Key | Public | Role | Shared with |
|---|---|---|---|
| **Viewing** | `pk_view = vk·G` | decrypts the balance (read) | auditors (read-only) |
| **Spending** | `pk_spend = sk_spend·G` | authorizes withdrawal | nobody |

- Balances are ElGamal-encrypted under **`pk_view`** → an auditor with `vk` can decrypt.
- Withdrawal is bound to the registered owner **`pk_spend`** → only the holder of `sk_spend`
  can withdraw.

## Withdraw circuit v2 (`circuits/withdraw_v2`) — implemented & verified
Public inputs: `c1,c2` (balance under `pk_view`), `pk_spend` (registered owner), `w`.
Private: `vk, sk_spend, bal, r_new`. Proves:
1. **Authorization:** `pk_spend == sk_spend·G` (knowledge of the spending key).
2. **Read:** `C2 == bal·G + vk·C1` (decrypt with the viewing key).
3. **Solvency:** `0 ≤ w ≤ bal` (40-bit range on `bal`, `w`, `bal−w`).
4. **New balance:** `C' = ElGamal(bal−w, pk_view)`.

7,799 gates · 11 public fields. **Native verify passes.**

**Security verified negatively:** an attacker holding only `vk` but not `sk_spend` fails the
authorization constraint (`pk.x == pk_spend_x`) → cannot produce a withdraw proof. So a viewing
key grants *read* but never *spend*. ✅

## Remaining integration (specified, not yet wired into the deployed demo)
To avoid destabilising the working testnet demo, these are designed but staged:
1. **Registration:** recipients register `(pk_view, pk_spend)`; or the batch payroll carries
   `pk_view[i]` (encryption target) and `pk_spend[i]` (owner) per recipient.
2. **Batch circuit:** encrypt each amount under `pk_view[i]`; output `pk_spend[i]` so the
   contract stores it alongside the ciphertext.
3. **Contract:** store `(ciphertext, pk_spend)` per recipient; `withdraw` passes the stored
   `pk_spend` as a public input to the v2 verifier (binding the withdrawal to the spend key).
4. Deploy a v2 withdraw verifier (its own VK) and point the contract at it.

## Hidden employer total (item 1b — designed, follow-up)
Encrypt the employer pool balance under `pk_view_emp`; `run_payroll` proves
`Σ amounts = empBal_old − empBal_new` and `empBal_old ≥ Σ` entirely in-circuit, so the total is
no longer revealed. The public integer pool is replaced by an encrypted balance; conservation is
enforced by the proof. (Funding/withdrawal boundaries with public USDC remain public — inherent.)

## ✅ v2 is LIVE on testnet (2026-06-30)
The full key-separated stack is deployed and verified end-to-end:

| Contract | Address |
|---|---|
| ConfidentialPayroll **v2** | `CD2DNAMJYMYTHUZPIBHFPCK24YOQGQSKLL2UR3TADL3QEQJHISMECY5I` |
| batch_v2 verifier | `CCCACJAGTRBUOXALXJFQYOKJ7QRVULZIVMIY46YTRGY57ZCAFILSSHNV` |
| withdraw_v2 verifier | `CAQHGJGZQHO5XDJ5V3TVTTZFPFXCDH6WD3KMLBONNM7E46QJRP2Y4RCU` |

- `run_payroll` (batch_v2) stores ciphertext (under pk_view) **+ owner pk_spend** per recipient.
- `withdraw` (withdraw_v2) checks the proof's `pk_spend` matches the stored owner **and** verifies
  knowledge of `sk_spend` — paid out 1,000 USDC, balance homomorphically reduced to 3,200.
- The frontend now decrypts with **viewing keys** (`vk`) that cannot spend; the auditor screenshot
  shows live balances (3,200 / 3,100 / 5,000 / 2,750) decrypted with viewing keys only.
