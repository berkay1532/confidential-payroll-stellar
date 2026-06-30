# Aligning Obscura with the official Stellar Confidential Token

On 2026-06-30 OpenZeppelin + Nethermind + SDF shipped a **developer preview of Confidential
Tokens on Stellar** — a SEP-41 wrapper that adds private balances + transfers, with an UltraHonk
verifier, auditor keys, and a compliance engine. This is the production-grade version of the
confidential-balance primitive Obscura hand-rolled. **Obscura should build on it.**

Sources: [OZ confidential contracts](https://github.com/OpenZeppelin/stellar-contracts/tree/feat/confidential-verifier-ultrahonk/packages/tokens/src/confidential) ·
[verifier](https://github.com/NethermindEth/rs-soroban-ultrahonk) ·
[SPP privacy pool](https://github.com/NethermindEth/stellar-private-payments) ·
[SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) ·
[COMPLIANCE.md](https://github.com/OpenZeppelin/stellar-contracts/blob/feat/confidential-verifier-ultrahonk/packages/tokens/src/confidential/docs/COMPLIANCE.md)

## We already converged on the official design
What we built independently matches the official primitive — strong validation:

| Dimension | Official (OZ) | Obscura (what we built) |
|---|---|---|
| Curve | Grumpkin (`y²=x³−17`) | **Grumpkin** ✅ |
| Verifier | `rs-soroban-ultrahonk @ 661db07` | **same repo, same commit** ✅ |
| Proof system | Noir / UltraHonk, cross-contract verify | **same** ✅ |
| Privacy model | confidentiality not anonymity (addresses visible, amounts hidden) | **same** ✅ |
| Wrapper | deposit SEP-41 / USDC (SAC) → confidential | **USDC via SAC wrap** ✅ |
| View vs spend | auditor keys separate from spend | **viewing ≠ spending (v2)** ✅ |
| Host functions | BN254 / CAP-80, Protocol 25+ | **same** ✅ |

Where the official design is **more advanced** (and what we'd inherit by building on it):
- **Pedersen commitments** (`C = v·G + r·H`, single point) instead of our ElGamal+DLOG — no
  discrete-log decryption; the owner keeps the opening `(v, r)` as local wallet state.
- **ECDH-derived blinding** — recipients/auditors recover amounts via per-transfer ephemeral
  Diffie-Hellman, not a static shared key (our static viewing key is the simpler version).
- **Dual-balance** (spendable/receiving) → griefing resistance + **proof-less merge**.
- **Dual-auditor** — each transfer emits ciphertexts under the sender's and recipient's auditor
  keys (real-time audit) — supersedes our single viewing key.
- **Spender delegation** (escrowed allowances) and a full **compliance engine**.

## How Obscura maps onto the official primitive
The OZ `ConfidentialToken` exposes exactly the entry points payroll needs:
`register(account, auditor_id)`, `deposit`, `confidential_transfer(from, to, data)`,
`withdraw`, `merge`, `confidential_balance(account)`, plus `Hooks` for compliance.

**Obscura becomes a payroll vertical on top:**
- **Employer & employees** hold OZ confidential USDC accounts (`register` + `deposit`).
- **Run payroll** = a batch of `confidential_transfer`s, one per employee — each hides the amount.
  (Replaces our custom batch circuit; an optional thin **PayrollOrchestrator** contract can wrap
  the loop + add payroll metadata/period nonces/events.)
- **Employees** `withdraw` to public USDC when they choose.
- **Auditor** = the OZ dual-auditor model (each account registers an auditor key; transfers emit
  ECDH ciphertexts) — replaces our static-viewing-key decrypt with the audited mechanism.
- **Compliance** = the OZ policy contract (`policy.is_authorized(account, token) -> bool`):
  allowlist / KYC / sanctions screening for payroll, plus freeze + SAC passthrough.
- **Obscura's differentiation stays the vertical**: payroll orchestration, the employer /
  employee / auditor UX, recurring runs, and payroll-specific compliance/tax hooks — **not** the
  crypto primitive.

## Migration plan (our MVP → built on OZ)
| Obscura MVP | → Built on OZ Confidential Token |
|---|---|
| Custom ElGamal balances | OZ Pedersen confidential balances |
| `run_payroll` batch circuit | N × `confidential_transfer` (± PayrollOrchestrator) |
| Static viewing-key decrypt | OZ dual-auditor ECDH ciphertexts |
| Our viewing≠spending withdraw | OZ `withdraw` (spend proof) |
| Funded integer pool | Employer's OZ confidential balance + `deposit`/`merge` |
| KYC/ASP "TODO" | OZ compliance policy contract (allowlist/KYC) |
| Our own audit need | Inherit OZ's audit (verifier + contracts under audit now) |

## Status & risk note
Both the OZ contracts and the verifier are **testnet-only, audits underway** — the same
`rs-soroban-ultrahonk` Obscura already depends on. So our "verifier dependency" risk is the
ecosystem's shared timeline, not an Obscura-specific gap: when the official primitive is audited
and mainnet-ready, so is the layer Obscura builds on.

## Decision
For the **hackathon**, keep the working standalone Obscura build (it demonstrates the full ZK
stack end-to-end and is a credible proof we understand the problem). For **production**, migrate
the confidential-balance layer to the **official OZ Confidential Token** and keep Obscura as the
payroll application on top. This aligns us with the ecosystem's official, soon-to-be-audited
primitive and lets us focus entirely on the payroll vertical.
