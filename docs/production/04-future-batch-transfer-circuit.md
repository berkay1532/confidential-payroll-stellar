# Future work / OZ contribution idea: a batch-transfer circuit

**Status: parked idea — revisit after the chunked flow is shipped.** Not on the current path.

## The opportunity
The official OZ Confidential Token uses a **per-transfer** model: `confidential_transfer` verifies
**one UltraHonk proof per recipient**. Soroban's per-tx resource budget fits ~**2** of these, so a
payroll of N is chunked into ⌈N/2⌉ transactions (see `spikes/README.md` — verified, works, scales).

A **batch-transfer circuit** — one proof attesting **N transfers at once** (the employer's
spendable decreases by the sum, N receiving balances credited, N auditor ciphertexts) — would let
a whole payroll settle in **one transaction** (one proof verification instead of N), removing the
chunking entirely. This is exactly the optimization our standalone Obscura batch circuit already
demonstrated (one proof, N recipients), just expressed inside the OZ token's model.

## Why it's a real contribution
- Useful to the **whole ecosystem**, not just payroll: any fan-out (airdrops, vesting, mass
  disbursements) on the OZ Confidential Token benefits.
- Natural upstream contribution to `OpenZeppelin/stellar-contracts` (a 7th circuit +
  `confidential_transfer_batch` entry point) or an Obscura extension contract.

## Cost / why parked now
- Designing + auditing a new circuit is significant (Noir + the dual-balance/dual-auditor/ECDH
  invariants must hold for the batched case) and the OZ contracts are still pre-audit.
- The chunked flow already works on the official primitive today and scales fine. Shipping on the
  official, soon-to-be-audited path first is the lower-risk move.

## Decision
Proceed with **chunking** (aligned with the official per-transfer docs). Record the batch-transfer
circuit as a future enhancement / potential OZ contribution to pick up once the official primitive
is audited and the product is live.
