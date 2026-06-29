# 🔐 Confidential Payroll on Stellar

> Pay your team in stablecoins — **salaries stay private on-chain**, while auditors can still **mathematically verify the totals**. Privacy and compliance, for payroll.

Built for **Stellar Hacks: Real-World ZK**. Confidential payroll is the missing privacy layer on Stellar's real-world money rails: the chain is transparent, so today every salary paid in on-chain USDC is public to everyone. We hide individual amounts with zero-knowledge proofs while keeping the system auditable.

---

## The problem

If you run payroll in on-chain USDC on Stellar today, **who earns what becomes visible to everyone** — exposing pay disparities, leaking competitive intelligence (a company's payroll size/structure), creating personal security risk, and blocking enterprise adoption. Without confidentiality, institutions can't meet compliance, protect competitive advantage, or meet basic employee privacy expectations. (Toku calls private payroll *"the killer app for institutional stablecoin adoption."*)

## The solution

A payroll product where **individual salaries are hidden on-chain** (encrypted balances), the employer pays the whole team in **one zero-knowledge-proven batch**, and an **auditor can verify aggregate totals via a view key without seeing the breakdown**. The ZK is load-bearing: the product literally cannot work without it.

## Why Stellar

- Real-world money rails (USDC via the Stellar Asset Contract, low fees, institutional settlement) — payroll is a native fit.
- **Native ZK substrate, live today:** since **Protocol 25 "X-Ray" (mainnet, 2026-01-22)** Soroban has native **BN254 + Poseidon/Poseidon2** host functions (CAP-0074/0075), on top of **BLS12-381** (CAP-0059). On-chain SNARK verification is a single pairing host call.
- The standard ZK toolchain works natively (BN254 curve, Baby Jubjub embedded curve, Poseidon hash).

## Target users

- **Primary:** crypto-native companies, DAOs, remote-first startups paying teams/contractors in USDC.
- **Secondary:** enterprises evaluating stablecoin payroll but blocked by transparency.
- **Auditors / finance teams:** need verifiable totals without per-employee disclosure.
- **Employees/contractors:** see only their own salary, cash out to public USDC on demand.

> Differentiation: Stellar already has many payroll projects — **all transparent**. The closest privacy-adjacent project (Zarf) does private *distribution/vesting*, not confidential-balance payroll with auditor proofs. The **payroll ∩ ZK-privacy** intersection is empty. That's our lane.

---

## Architecture (high level)

```
Frontend (Next.js) ──tx + proof──> Soroban contracts ──> Stellar RPC
  employer / employee / auditor          │
  client-side proof gen (WASM)           ├─ Verifier  (Noir/UltraHonk, BN254) — pure crypto
                                         ├─ Payroll   (encrypted balances, replay guard)
                                         ├─ Policy     (view-keys, allow-list, limits)
                                         └─ SAC bridge (USDC ⇄ confidential balance)
```

**Key property:** the contract performs **no EC math on balances** — it stores ciphertexts as opaque bytes and only verifies the batch proof. All correctness (conservation, range, encryption) is proven inside the circuit. See [`docs/architecture.md`](docs/architecture.md).

## Tech stack

| Layer | Choice |
|---|---|
| Circuits | **Noir** (`nargo`), BN254 |
| On-chain verifier | **UltraHonk / BN254 verifier** on Soroban |
| Contracts | Soroban (Rust, `soroban-sdk`) |
| Encryption | Twisted ElGamal over Baby Jubjub (homomorphic balances) |
| Hash | Poseidon (native host function) |
| Frontend | Next.js + Tailwind (mobile-first), Stellar Wallets Kit / passkeys |
| Asset | USDC via SAC (testnet) |

## Repository layout

```
confidential-payroll/
├── circuits/    # Noir circuits (batch, withdraw)
├── contracts/   # Soroban contracts (verifier, payroll, policy)
├── web/         # Next.js frontend
└── docs/        # architecture, spike plan, demo script
```

## Status / roadmap

- [x] **Spike Gate 1:** Noir → Soroban verifier path proven end-to-end on testnet ✅ (see [`docs/gate1-result.md`](docs/gate1-result.md))
- [x] Spike Gate 2/3: crypto core (ElGamal + range + commitment) verified on-chain ✅ via updated host-fn verifier `rs-soroban-ultrahonk@661db07` (see [`docs/gate2-result.md`](docs/gate2-result.md))
- [x] Core: batch circuit + `ConfidentialPayroll` verifier-gateway working end-to-end on testnet ✅ (see [`docs/e2e-result.md`](docs/e2e-result.md))
- [x] Money loop: real USDC `fund` → confidential `run_payroll` → `withdraw` (ZK ownership) ✅
- [x] Frontend: Next.js dApp (employer/employee/auditor) + wallet connect + live on-chain reads ✅
- [ ] Polish demo (explorer links, demo script) + analytics + feedback
- [ ] Deploy to Vercel (final step)
- [ ] Mainnet vision: recurring payroll, KYC allow-list, total-proof circuit, confidential B2B settlement

## Deployed (Stellar testnet)

| Contract | Address |
|---|---|
| ConfidentialPayroll | `CDIN5OI4IUEECZOYAR3KWIWDVGPBJK6V4CRUW6W54OWMRGSZHUYNLVFY` |
| Batch verifier | `CCNKYJVGKAXN4BDBRMU7UL54ZD4VNQOFOGZBAXXRVMDK5Q3A3VSW7QZ2` |
| Withdraw verifier | `CD7NUAGWFAJRX6ZMSTDTJ6JBZ2BQIUKHXP7WMJDKUT5SMICOYC5U37CE` |
| Test USDC (SAC) | `CAGB4O4Q6D4EPE3MLXA32MVSESGIA5JR2NUXGJUB3LZCEXSAJDB23WEC` |

## Getting started

> Prerequisites: Node 20+, Rust + `cargo`, Stellar CLI 26+, **Noir (`noirup`) + BN254/Soroban backend** (not yet installed in this environment).

```bash
# circuits
cd circuits && nargo check

# contracts
cd contracts && cargo build --target wasm32-unknown-unknown --release

# frontend
cd web && npm install && npm run dev
```

## License

MIT
