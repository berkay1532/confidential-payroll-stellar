/**
 * Obscura payroll spike — a CONFIDENTIAL PAYROLL RUN on the official OZ Confidential Token.
 * Employer pays N employees via N `confidential_transfer`s; each salary is hidden on-chain,
 * proven with an UltraHonk transfer proof, and recovered by the recipient/auditor from the
 * event ciphertexts. This is Obscura's payroll vertical sitting on the official primitive.
 */
import { Keypair } from "@stellar/stellar-sdk";
import { RPC_URL, PASSPHRASE, loadDeployment, friendbotFund } from "./_shared.js";
import { ChainClient, keypairSigner, type Signer } from "../packages/sdk/src/chain/client.js";
import { deriveKeys, type KeyPair } from "../packages/sdk/src/crypto/keys.js";
import { addressToField } from "../packages/sdk/src/crypto/address.js";
import { randomScalar } from "../packages/sdk/src/crypto/field.js";
import { type Point } from "../packages/sdk/src/crypto/grumpkin.js";
import { buildRegisterWitness } from "../packages/sdk/src/witness/register.js";
import { buildTransferWitness } from "../packages/sdk/src/witness/transfer.js";
import { CircuitProver } from "../packages/sdk/src/proving/prover.js";
import { loadCircuit } from "../packages/sdk/src/proving/artifacts.js";
import { submitRegister, submitDeposit, submitMerge, submitTransfer } from "../packages/sdk/src/chain/contract.js";
import { StateEngine, MemoryStore } from "../packages/sdk/src/state/index.js";

const AUDITOR_ID = 0;
const TEAM = [
  { name: "Ada", salary: 4200n },
  { name: "Borys", salary: 3100n },
  { name: "Chen", salary: 5000n },
  { name: "Diego", salary: 2750n },
];
const BUDGET = 16000n;

async function fresh(): Promise<{ kp: Keypair; signer: Signer }> {
  const kp = Keypair.random();
  await friendbotFund(kp.publicKey());
  return { kp, signer: keypairSigner(kp.secret(), PASSPHRASE) };
}

async function main() {
  const dep = loadDeployment();
  const client = new ChainClient({ rpcUrl: RPC_URL, networkPassphrase: PASSPHRASE,
    contracts: { token: dep.contracts.token, verifier: dep.contracts.verifier, auditor: dep.contracts.auditor } });
  const addrF = addressToField(dep.contracts.token);
  const kAud: Point = await client.auditorKey(AUDITOR_ID);
  const registerProver = new CircuitProver(loadCircuit("register"));
  const transferProver = new CircuitProver(loadCircuit("transfer"));

  console.log(`\nObscura confidential payroll on the official OZ token (${dep.contracts.token})`);
  const total = TEAM.reduce((a, t) => a + t.salary, 0n);

  // employer + employees
  const employer = await fresh();
  const employerKeys = deriveKeys(randomScalar(), addrF);
  const employerEngine = new StateEngine({ client, store: new MemoryStore(), keys: employerKeys, address: employer.kp.publicKey(), fromLedger: dep.deployedAtLedger });
  const emps = [];
  for (const t of TEAM) {
    const acct = await fresh();
    const keys = deriveKeys(randomScalar(), addrF);
    emps.push({ ...t, acct, keys, engine: new StateEngine({ client, store: new MemoryStore(), keys, address: acct.kp.publicKey(), fromLedger: dep.deployedAtLedger }) });
  }

  // register everyone
  console.log("\n[register] employer + " + TEAM.length + " employees");
  for (const who of [{ keys: employerKeys, acct: employer }, ...emps.map((e) => ({ keys: e.keys, acct: e.acct }))]) {
    const w = buildRegisterWitness(who.keys);
    const { proof } = await registerProver.prove(w.inputs);
    await submitRegister(client, who.acct.signer, who.acct.kp.publicKey(), AUDITOR_ID, w, proof);
  }
  console.log("  done");

  // employer funds the payroll budget (public XLM -> confidential)
  console.log(`\n[fund] employer deposits payroll budget ${BUDGET}`);
  await submitDeposit(client, employer.signer, employer.kp.publicKey(), employer.kp.publicKey(), BUDGET);
  await submitMerge(client, employer.signer, employer.kp.publicKey());
  await employerEngine.sync();

  // PAYROLL RUN — one confidential_transfer per employee, amounts hidden on-chain
  console.log(`\n[payroll run] paying ${TEAM.length} employees, ${total} total — amounts hidden on-chain`);
  for (const e of emps) {
    const s = await employerEngine.current();
    const w = buildTransferWitness({ keys: employerKeys, v: s.spendable.v, r: s.spendable.r, amount: e.salary, pvkB: e.keys.PVK, kAudR: kAud, kAudS: kAud });
    const { proof } = await transferProver.prove(w.inputs);
    const r = await submitTransfer(client, employer.signer, employer.kp.publicKey(), e.acct.kp.publicKey(), w, proof);
    await employerEngine.sync();
    console.log(`  paid ${e.name.padEnd(6)} (tx ${r.hash.slice(0, 8)}…, ZK proof OK — salary encrypted on-chain)`);
  }

  // verify: employer debited by total; each employee received their (hidden) salary
  console.log("\n[verify]");
  const fin = await employerEngine.sync();
  console.log(`  employer spendable = ${fin.spendable.v} (budget ${BUDGET} - payroll ${total} = ${BUDGET - total}) ${fin.spendable.v === BUDGET - total ? "✓" : "✗"}`);
  for (const e of emps) {
    const b = await e.engine.sync();
    const ok = b.receiving.v === e.salary;
    console.log(`  ${e.name.padEnd(6)} received = ${b.receiving.v} (recovered from auditor/recipient ciphertext) ${ok ? "✓" : "✗"}`);
  }
  console.log("\n✅ confidential payroll run complete on the official OZ Confidential Token.");
  await Promise.all([registerProver.destroy(), transferProver.destroy()]);
}
main().catch((e) => { console.error(e); process.exit(1); });
