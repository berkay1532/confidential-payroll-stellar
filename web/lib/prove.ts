"use client";
import { pubkeyHex } from "./decrypt";
import { DEMO_VIEWING_KEYS } from "./config";

// Client-side proof generation (Noir + Barretenberg, WASM). Runs in the browser so secrets
// never leave the device. Dynamic-imported so the heavy WASM bundle stays out of SSR/initial load.
//
// Demo spending keys (would never be in a real client — here only to reproduce the sample batch).
const DEMO_SPENDING_KEYS = [
  55555555555555555555n,
  66666666666666666666n,
  77777777777777777777n,
  88888888888888888888n,
];
const DEMO_AMOUNTS = [4200, 3100, 5000, 2750];
const DEMO_RS = [
  "12121212121212121212",
  "23232323232323232323",
  "34343434343434343434",
  "45454545454545454545",
];

export type ProofBundle = { proof: Uint8Array; publicInputs: Uint8Array };

function concatFields(hexes: string[]): Uint8Array {
  const out = new Uint8Array(hexes.length * 32);
  hexes.forEach((h, i) => {
    const hx = BigInt(h).toString(16).padStart(64, "0");
    for (let j = 0; j < 32; j++) out[i * 32 + j] = parseInt(hx.slice(j * 2, j * 2 + 2), 16);
  });
  return out;
}

/** Generate the batch payroll proof in-browser from the demo amounts + recipient keys. */
export async function proveBatchInBrowser(): Promise<ProofBundle> {
  const [{ Noir }, { UltraHonkBackend }] = await Promise.all([
    import("@noir-lang/noir_js"),
    import("@aztec/bb.js"),
  ]);
  const circuit = await (await fetch("/circuits/batch_v2.json")).json();

  const pv = [0, 1, 2, 3].map((i) => pubkeyHex(DEMO_VIEWING_KEYS[i]));
  const ps = DEMO_SPENDING_KEYS.map((k) => pubkeyHex(k));
  const inputs = {
    amounts: DEMO_AMOUNTS.map(String),
    rs: DEMO_RS,
    pk_view_x: pv.map((p) => p.x),
    pk_view_y: pv.map((p) => p.y),
    pk_spend_x: ps.map((p) => p.x),
    pk_spend_y: ps.map((p) => p.y),
  };

  const noir = new Noir(circuit);
  const { witness } = await noir.execute(inputs);
  // single-thread keeps us off SharedArrayBuffer (no cross-origin-isolation headers needed)
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
  const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });

  return { proof, publicInputs: concatFields(publicInputs) };
}
