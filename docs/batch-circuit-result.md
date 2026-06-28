# Batch payroll circuit — verified on-chain (N=4) ✅

**Date:** 2026-06-28 · **Network:** Stellar testnet

The real batch circuit (`circuits/src/main.nr`) proves a payroll run over N recipients:
range (each amount < 2^40) + conservation (revealed total = sum) + EC-ElGamal encryption
(`pk=sk*G`, `C1=r*G`, `C2=amount*G+r*pk`) per recipient. Individual salaries stay hidden;
the per-recipient ciphertexts + the auditor-visible total are public outputs.

| Metric | N=4 |
|---|---|
| Circuit size | 14,664 gates |
| Public outputs | 25 fields (6 per recipient + total) |
| Proof size | 14,592 bytes |
| Native verify | ✅ |
| **On-chain verify (host-fn verifier)** | ✅ tx `200cad6f7a8abe981339dcf15bbc725c668f9ccf1544ceffa8b5bea80c4767f1` |
| **On-chain cost** | ~128,797 stroops (~0.013 XLM) |

**Key result — verification cost is ~constant in N:** single-recipient (8,510 gates) cost ~125k
stroops; N=4 (14,664 gates) cost ~129k. The host-function UltraHonk verifier's cost barely
moves with circuit size, so batch scaling (larger N) stays comfortably within the 400M budget.

Batch verifier contract (this VK): `CCNKYJVGKAXN4BDBRMU7UL54ZD4VNQOFOGZBAXXRVMDK5Q3A3VSW7QZ2`

Note: a fresh-deploy `Error(Storage, MissingValue)` can appear on the first invoke before the
constructor's VK write propagates — retry once the contract is indexed.
