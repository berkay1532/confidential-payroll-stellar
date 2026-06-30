/** Route a REAL confidential_transfer through Obscura's PayrollOrchestrator (on testnet). */
import { Keypair, xdr, Address } from "@stellar/stellar-sdk";
import { RPC_URL, PASSPHRASE, loadDeployment, friendbotFund } from "./_shared.js";
import { ChainClient, keypairSigner } from "../packages/sdk/src/chain/client.js";
import { deriveKeys } from "../packages/sdk/src/crypto/keys.js";
import { addressToField } from "../packages/sdk/src/crypto/address.js";
import { randomScalar } from "../packages/sdk/src/crypto/field.js";
import { buildRegisterWitness } from "../packages/sdk/src/witness/register.js";
import { buildTransferWitness } from "../packages/sdk/src/witness/transfer.js";
import { CircuitProver } from "../packages/sdk/src/proving/prover.js";
import { loadCircuit } from "../packages/sdk/src/proving/artifacts.js";
import { submitRegister, submitDeposit, submitMerge } from "../packages/sdk/src/chain/contract.js";
import { encodeTransferData } from "../packages/sdk/src/chain/payload.js";
import { StateEngine, MemoryStore } from "../packages/sdk/src/state/index.js";

const ORCH = "CDW2NEUEHXUN6G5W62E4YMR26F2YFXPB74UZ34PEO5UVU4BGSU7WHXF4";
const AUDITOR_ID = 0;
async function fresh() { const kp = Keypair.random(); await friendbotFund(kp.publicKey()); return { kp, signer: keypairSigner(kp.secret(), PASSPHRASE) }; }

async function main() {
  const dep = loadDeployment();
  const client = new ChainClient({ rpcUrl: RPC_URL, networkPassphrase: PASSPHRASE, contracts: { token: dep.contracts.token, verifier: dep.contracts.verifier, auditor: dep.contracts.auditor } });
  const addrF = addressToField(dep.contracts.token);
  const kAud = await client.auditorKey(AUDITOR_ID);
  const regP = new CircuitProver(loadCircuit("register"));
  const txP = new CircuitProver(loadCircuit("transfer"));

  const employer = await fresh(); const ek = deriveKeys(randomScalar(), addrF);
  const employee = await fresh(); const wk = deriveKeys(randomScalar(), addrF);
  const eEng = new StateEngine({ client, store: new MemoryStore(), keys: ek, address: employer.kp.publicKey(), fromLedger: dep.deployedAtLedger });
  const wEng = new StateEngine({ client, store: new MemoryStore(), keys: wk, address: employee.kp.publicKey(), fromLedger: dep.deployedAtLedger });

  console.log("registering employer + employee…");
  for (const x of [{k:ek,a:employer},{k:wk,a:employee}]) { const w = buildRegisterWitness(x.k); const { proof } = await regP.prove(w.inputs); await submitRegister(client, x.a.signer, x.a.kp.publicKey(), AUDITOR_ID, w, proof); }
  console.log("employer deposits 9000…");
  await submitDeposit(client, employer.signer, employer.kp.publicKey(), employer.kp.publicKey(), 9000n);
  await submitMerge(client, employer.signer, employer.kp.publicKey());
  await eEng.sync();

  console.log("building transfer proof (4200) + routing THROUGH the orchestrator…");
  const s = await eEng.current();
  const w = buildTransferWitness({ keys: ek, v: s.spendable.v, r: s.spendable.r, amount: 4200n, pvkB: wk.PVK, kAudR: kAud, kAudS: kAud });
  const { proof } = await txP.prove(w.inputs);
  const data = encodeTransferData(w, proof); // xdr.ScVal (Bytes)

  const nonce = Buffer.alloc(32, 7);
  const args: xdr.ScVal[] = [
    new Address(employer.kp.publicKey()).toScVal(),
    xdr.ScVal.scvBytes(nonce),
    xdr.ScVal.scvVec([new Address(employee.kp.publicKey()).toScVal()]),
    xdr.ScVal.scvVec([data]),
  ];
  const r = await client.invoke(ORCH, "run_payroll", args, employer.signer);
  console.log(`  orchestrator.run_payroll tx ${r.hash.slice(0,8)}… OK`);

  const b = await wEng.sync();
  console.log(`  employee received = ${b.receiving.v} ${b.receiving.v === 4200n ? "✅ (routed through orchestrator)" : "✗"}`);
  await Promise.all([regP.destroy(), txP.destroy()]);
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
