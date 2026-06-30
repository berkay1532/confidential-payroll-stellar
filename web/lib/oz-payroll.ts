"use client";
// Obscura payroll on the official OZ Confidential Token, in the browser.
// Uses the vendored OZ SDK (Pedersen/ECDH StateEngine + UltraHonk proving via bb.js).
// A batched confidential payroll: N sequential transfer proofs generated on-device, submitted
// via our PayrollOrchestrator in chunks (the per-tx confidential_transfer resource cap).

import { Keypair, xdr, Address, Networks } from "@stellar/stellar-sdk";
import { ChainClient, keypairSigner } from "./ozsdk/chain/client.js";
import { deriveKeys } from "./ozsdk/crypto/keys.js";
import { addressToField } from "./ozsdk/crypto/address.js";
import { randomScalar } from "./ozsdk/crypto/field.js";
import { buildRegisterWitness } from "./ozsdk/witness/register.js";
import { buildTransferWitness } from "./ozsdk/witness/transfer.js";
import { CircuitProver } from "./ozsdk/proving/prover.js";
import { submitRegister, submitDeposit, submitMerge } from "./ozsdk/chain/contract.js";
import { encodeTransferData } from "./ozsdk/chain/payload.js";
import { StateEngine, MemoryStore } from "./ozsdk/state/index.js";

const RPC = "https://soroban-testnet.stellar.org";
const PASS = Networks.TESTNET;
// Our deployed OZ confidential-token stack + PayrollOrchestrator (testnet).
const OZ = {
  token: "CC6LHLBJE6AZDDME2XMQAVXNNHOLEOJMXRDTENX2I4XI6FKETWJNSLD4",
  verifier: "CDO2LM3GJBJOPTBGF3EGPC7VEKTUDS4HVOJGD3R4Y5QYBMD55KJRYEG5",
  auditor: "CCYH45W6LQRCTLWYIHVIX5T4PGN6LFFQ7PX4ZCML7YKC3KIPATFVEBII",
  ledger: 3366568,
};
const ORCH = "CDW2NEUEHXUN6G5W62E4YMR26F2YFXPB74UZ34PEO5UVU4BGSU7WHXF4";
const AUDITOR_ID = 0;
const CHUNK = 2;

export type Employee = { name: string; salary: bigint };
type Log = (s: string) => void;

async function fetchCircuit(name: string) {
  return (await (await fetch(`/circuits/${name}.json`)).json());
}
async function friendbot(pub: string) {
  await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(pub)}`);
}
async function fresh() {
  const kp = Keypair.random();
  await friendbot(kp.publicKey());
  return { kp, signer: keypairSigner(kp.secret(), PASS) };
}
const randNonce = () =>
  Buffer.from(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)));

/** Run a self-contained batched confidential payroll on the official OZ token (demo). */
export async function runOzPayroll(team: Employee[], budget: bigint, log: Log) {
  const client = new ChainClient({
    rpcUrl: RPC,
    networkPassphrase: PASS,
    contracts: { token: OZ.token, verifier: OZ.verifier, auditor: OZ.auditor },
  });
  const addrF = addressToField(OZ.token);
  const kAud = await client.auditorKey(AUDITOR_ID);
  const regP = new CircuitProver(await fetchCircuit("register"));
  const txP = new CircuitProver(await fetchCircuit("transfer"));
  const total = team.reduce((a, t) => a + t.salary, 0n);

  log("creating employer + " + team.length + " employee accounts…");
  const employer = await fresh();
  const ek = deriveKeys(randomScalar(), addrF);
  const eEng = new StateEngine({ client, store: new MemoryStore(), keys: ek, address: employer.kp.publicKey(), fromLedger: OZ.ledger });
  const emps: any[] = [];
  for (const t of team) {
    const a = await fresh();
    const k = deriveKeys(randomScalar(), addrF);
    emps.push({ ...t, a, k, eng: new StateEngine({ client, store: new MemoryStore(), keys: k, address: a.kp.publicKey(), fromLedger: OZ.ledger }) });
  }

  log("registering confidential accounts…");
  for (const x of [{ k: ek, a: employer }, ...emps.map((e) => ({ k: e.k, a: e.a }))]) {
    const w = buildRegisterWitness(x.k);
    const { proof } = await regP.prove(w.inputs);
    await submitRegister(client, x.a.signer, x.a.kp.publicKey(), AUDITOR_ID, w, proof);
  }

  log("employer deposits budget " + budget + " (public → confidential)…");
  await submitDeposit(client, employer.signer, employer.kp.publicKey(), employer.kp.publicKey(), budget);
  await submitMerge(client, employer.signer, employer.kp.publicKey());
  await eEng.sync();

  log("generating " + team.length + " transfer proofs on-device…");
  const tos: xdr.ScVal[] = [];
  const datas: xdr.ScVal[] = [];
  for (const e of emps) {
    const s = await eEng.current();
    const w = buildTransferWitness({ keys: ek, v: s.spendable.v, r: s.spendable.r, amount: e.salary, pvkB: e.k.PVK, kAudR: kAud, kAudS: kAud });
    const { proof } = await txP.prove(w.inputs);
    tos.push(new Address(e.a.kp.publicKey()).toScVal());
    datas.push(encodeTransferData(w, proof));
    await eEng.setSpendable({ v: w.next.v, r: w.next.r });
    log("  proof for " + e.name + " ✓");
  }

  log("submitting via PayrollOrchestrator in chunks of " + CHUNK + "…");
  for (let i = 0; i < tos.length; i += CHUNK) {
    const ct = tos.slice(i, i + CHUNK);
    const cd = datas.slice(i, i + CHUNK);
    const args: xdr.ScVal[] = [
      new Address(employer.kp.publicKey()).toScVal(),
      xdr.ScVal.scvBytes(randNonce()),
      xdr.ScVal.scvVec(ct),
      xdr.ScVal.scvVec(cd),
    ];
    const r = await client.invoke(ORCH, "run_payroll", args, employer.signer);
    log("  chunk " + (i / CHUNK + 1) + ": tx " + r.hash.slice(0, 8) + "… ✓ (" + ct.length + " transfers)");
  }

  const fin = await eEng.sync();
  const results: { name: string; received: bigint; ok: boolean }[] = [];
  for (const e of emps) {
    const b = await e.eng.sync();
    results.push({ name: e.name, received: b.receiving.v, ok: b.receiving.v === e.salary });
  }
  return { employerSpendable: fin.spendable.v, expectedSpendable: budget - total, total, results };
}
