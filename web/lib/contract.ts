import {
  rpc,
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { NETWORK, CONTRACTS } from "./config";

const server = new rpc.Server(NETWORK.rpcUrl, { allowHttp: true });

// A funded testnet account used only as the source for read-only simulations.
const READ_SOURCE = "GBAOAQSKITCJM4NCJT4WOXWHGGSWYD7VUTEPIVFCSD6YZBQNAYYC7PWK";

type Signer = (xdrTx: string) => Promise<string>;

async function simulate(contractId: string, method: string, args: xdr.ScVal[]) {
  const account = await server.getAccount(READ_SOURCE);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`simulate ${method} failed`);
  }
  return scValToNative(sim.result.retval);
}

// ---- reads ----

export async function getPool(): Promise<bigint> {
  return BigInt(await simulate(CONTRACTS.payroll, "pool", []));
}

export async function getCustody(): Promise<bigint> {
  return BigInt(await simulate(CONTRACTS.payroll, "custody", []));
}

/** Returns the raw encrypted balance ciphertext (hex) or null if unset. */
export async function getBalanceCiphertext(index: number): Promise<string | null> {
  const v = await simulate(CONTRACTS.payroll, "balance_of", [
    nativeToScVal(index, { type: "u32" }),
  ]);
  if (!v) return null;
  return Buffer.from(v as Uint8Array).toString("hex");
}

export async function getUsdcBalance(account: string): Promise<bigint> {
  return BigInt(
    await simulate(CONTRACTS.usdc, "balance", [Address.fromString(account).toScVal()]),
  );
}

// ---- writes (require a connected wallet signer) ----

async function send(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  publicKey: string,
  sign: Signer,
): Promise<string> {
  const account = await server.getAccount(publicKey);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(built);
  const signedXdr = await sign(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  const res = await server.sendTransaction(signed);
  if (res.status === "ERROR") throw new Error("submit failed");

  // poll for completion
  let got = await server.getTransaction(res.hash);
  for (let i = 0; i < 15 && got.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    got = await server.getTransaction(res.hash);
  }
  if (got.status !== "SUCCESS") throw new Error(`tx ${got.status}`);
  return res.hash;
}

const bytesScVal = (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));

export async function fund(
  amount: bigint,
  publicKey: string,
  sign: Signer,
): Promise<string> {
  return send(
    CONTRACTS.payroll,
    "fund",
    [Address.fromString(publicKey).toScVal(), nativeToScVal(amount, { type: "i128" })],
    publicKey,
    sign,
  );
}

export async function runPayroll(
  periodNonce: Uint8Array,
  publicInputs: Uint8Array,
  proof: Uint8Array,
  publicKey: string,
  sign: Signer,
): Promise<string> {
  return send(
    CONTRACTS.payroll,
    "run_payroll",
    [
      Address.fromString(publicKey).toScVal(),
      bytesScVal(periodNonce),
      bytesScVal(publicInputs),
      bytesScVal(proof),
    ],
    publicKey,
    sign,
  );
}

export async function withdraw(
  index: number,
  publicInputs: Uint8Array,
  proof: Uint8Array,
  publicKey: string,
  sign: Signer,
): Promise<string> {
  return send(
    CONTRACTS.payroll,
    "withdraw",
    [
      Address.fromString(publicKey).toScVal(),
      nativeToScVal(index, { type: "u32" }),
      bytesScVal(publicInputs),
      bytesScVal(proof),
    ],
    publicKey,
    sign,
  );
}
