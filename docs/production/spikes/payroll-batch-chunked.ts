/** Obscura batched confidential payroll on the official OZ Confidential Token:
 *  N sequential transfer proofs generated OFFLINE, submitted via orchestrator.run_payroll
 *  in chunks of 2 (the per-tx confidential_transfer resource cap). */
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
const CHUNK = 2;
const TEAM: [string, bigint][] = [["Ada",4200n],["Borys",3100n],["Chen",5000n],["Diego",2750n]];
const BUDGET = 16000n;
const randNonce = () => Buffer.from(Array.from({length:32},()=>Math.floor(Math.random()*256)));
async function fresh(){ const kp=Keypair.random(); await friendbotFund(kp.publicKey()); return {kp,signer:keypairSigner(kp.secret(),PASSPHRASE)}; }

async function main(){
  const dep=loadDeployment();
  const client=new ChainClient({rpcUrl:RPC_URL,networkPassphrase:PASSPHRASE,contracts:{token:dep.contracts.token,verifier:dep.contracts.verifier,auditor:dep.contracts.auditor}});
  const addrF=addressToField(dep.contracts.token);
  const kAud=await client.auditorKey(AUDITOR_ID);
  const regP=new CircuitProver(loadCircuit("register"));
  const txP=new CircuitProver(loadCircuit("transfer"));
  const total=TEAM.reduce((a,[,s])=>a+s,0n);

  const employer=await fresh(); const ek=deriveKeys(randomScalar(),addrF);
  const eEng=new StateEngine({client,store:new MemoryStore(),keys:ek,address:employer.kp.publicKey(),fromLedger:dep.deployedAtLedger});
  const emps=[] as any[]; for(const [name,salary] of TEAM){ const a=await fresh(); const k=deriveKeys(randomScalar(),addrF); emps.push({name,salary,a,k,eng:new StateEngine({client,store:new MemoryStore(),keys:k,address:a.kp.publicKey(),fromLedger:dep.deployedAtLedger})}); }

  console.log("registering employer + "+TEAM.length+" employees…");
  for(const x of [{k:ek,a:employer},...emps.map(e=>({k:e.k,a:e.a}))]){ const w=buildRegisterWitness(x.k); const {proof}=await regP.prove(w.inputs); await submitRegister(client,x.a.signer,x.a.kp.publicKey(),AUDITOR_ID,w,proof); }
  console.log("employer deposits budget "+BUDGET+"…");
  await submitDeposit(client,employer.signer,employer.kp.publicKey(),employer.kp.publicKey(),BUDGET);
  await submitMerge(client,employer.signer,employer.kp.publicKey()); await eEng.sync();

  console.log("generating "+TEAM.length+" sequential transfer proofs OFFLINE…");
  const tos:xdr.ScVal[]=[]; const datas:xdr.ScVal[]=[];
  for(const e of emps){
    const s=await eEng.current();
    const w=buildTransferWitness({keys:ek,v:s.spendable.v,r:s.spendable.r,amount:e.salary,pvkB:e.k.PVK,kAudR:kAud,kAudS:kAud});
    const {proof}=await txP.prove(w.inputs);
    tos.push(new Address(e.a.kp.publicKey()).toScVal()); datas.push(encodeTransferData(w,proof));
    await eEng.setSpendable({v:w.next.v,r:w.next.r});
    console.log("  proof for "+e.name+" ready");
  }

  console.log("submitting payroll in chunks of "+CHUNK+" (one orchestrator.run_payroll per chunk)…");
  for(let i=0;i<tos.length;i+=CHUNK){
    const ct=tos.slice(i,i+CHUNK), cd=datas.slice(i,i+CHUNK);
    const args:xdr.ScVal[]=[ new Address(employer.kp.publicKey()).toScVal(), xdr.ScVal.scvBytes(randNonce()), xdr.ScVal.scvVec(ct), xdr.ScVal.scvVec(cd) ];
    const r=await client.invoke(ORCH,"run_payroll",args,employer.signer);
    console.log("  chunk "+(i/CHUNK+1)+": tx "+r.hash.slice(0,8)+"… OK ("+ct.length+" confidential transfers)");
  }

  console.log("[verify]");
  const fin=await eEng.sync();
  console.log("  employer spendable = "+fin.spendable.v+" (budget "+BUDGET+" - "+total+" = "+(BUDGET-total)+") "+(fin.spendable.v===BUDGET-total?"✓":"✗"));
  for(const e of emps){ const b=await e.eng.sync(); console.log("  "+e.name.padEnd(6)+" received = "+b.receiving.v+" "+(b.receiving.v===e.salary?"✓":"✗")); }
  console.log("✅ batched confidential payroll complete via PayrollOrchestrator ("+Math.ceil(TEAM.length/CHUNK)+" txs).");
  await Promise.all([regP.destroy(),txP.destroy()]);
}
main().catch(e=>{console.error(e.message||e);process.exit(1);});
