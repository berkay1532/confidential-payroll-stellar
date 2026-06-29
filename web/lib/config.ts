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
  payroll: "CDIN5OI4IUEECZOYAR3KWIWDVGPBJK6V4CRUW6W54OWMRGSZHUYNLVFY",
  usdc: "CAGB4O4Q6D4EPE3MLXA32MVSESGIA5JR2NUXGJUB3LZCEXSAJDB23WEC",
  batchVerifier: "CCNKYJVGKAXN4BDBRMU7UL54ZD4VNQOFOGZBAXXRVMDK5Q3A3VSW7QZ2",
  withdrawVerifier: "CD7NUAGWFAJRX6ZMSTDTJ6JBZ2BQIUKHXP7WMJDKUT5SMICOYC5U37CE",
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

// Demo viewing keys (per-employee). In this MVP the viewing key equals the spending key;
// an auditor given these can decrypt each employee's on-chain balance (selective disclosure).
export const DEMO_VIEWING_KEYS: Record<number, bigint> = {
  0: 55555555555555555555n,
  1: 66666666666666666666n,
  2: 77777777777777777777n,
  3: 88888888888888888888n,
};
