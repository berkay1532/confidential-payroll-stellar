// Deployed Confidential Payroll contracts (Stellar testnet).
export const NETWORK = {
  passphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.org",
  explorerTx: (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`,
  explorerContract: (c: string) =>
    `https://stellar.expert/explorer/testnet/contract/${c}`,
} as const;

export const CONTRACTS = {
  // v2 stack — viewing key ≠ spending key (production-grade key separation)
  payroll: "CD2DNAMJYMYTHUZPIBHFPCK24YOQGQSKLL2UR3TADL3QEQJHISMECY5I",
  usdc: "CAGB4O4Q6D4EPE3MLXA32MVSESGIA5JR2NUXGJUB3LZCEXSAJDB23WEC",
  batchVerifier: "CCCACJAGTRBUOXALXJFQYOKJ7QRVULZIVMIY46YTRGY57ZCAFILSSHNV",
  withdrawVerifier: "CAQHGJGZQHO5XDJ5V3TVTTZFPFXCDH6WD3KMLBONNM7E46QJRP2Y4RCU",
} as const;

// Demo recipients of the sample batch payroll (amounts hidden on-chain).
// Index maps to the on-chain encrypted Balance(index). Names/amounts are demo metadata
// the auditor/employer keep off-chain; the chain only stores the ciphertext.
export const DEMO_RECIPIENTS = [
  { index: 0, name: "Ada", note: "engineer" },
  { index: 1, name: "Borys", note: "designer" },
  { index: 2, name: "Chen", note: "ops" },
  { index: 3, name: "Diego", note: "growth" },
] as const;

// Demo VIEWING keys (per-employee) — v2: distinct from the spending keys. Balances are encrypted
// under pk_view = vk·G; an auditor given a vk can decrypt that employee's balance (read-only) but
// cannot withdraw (that needs the separate spending key). Spending keys are never in the client.
export const DEMO_VIEWING_KEYS: Record<number, bigint> = {
  0: 11111111111111111111n,
  1: 22222222222222222222n,
  2: 33333333333333333333n,
  3: 44444444444444444444n,
};
