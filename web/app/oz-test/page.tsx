"use client";
import { useEffect, useState } from "react";

// Diagnostic: exercises the vendored OZ SDK's crypto + proving IN THE BROWSER (no chain):
// derive Grumpkin keys, build a register witness, generate the UltraHonk proof via bb.js.
export default function OzTest() {
  const [out, setOut] = useState("running…");
  useEffect(() => {
    (async () => {
      try {
        const [{ deriveKeys }, { addressToField }, { randomScalar }, { buildRegisterWitness }, { buildTransferWitness }, { CircuitProver }, { Grumpkin, G }] =
          await Promise.all([
            import("@/lib/ozsdk/crypto/keys.js"),
            import("@/lib/ozsdk/crypto/address.js"),
            import("@/lib/ozsdk/crypto/field.js"),
            import("@/lib/ozsdk/witness/register.js"),
            import("@/lib/ozsdk/witness/transfer.js"),
            import("@/lib/ozsdk/proving/prover.js"),
            import("@/lib/ozsdk/crypto/grumpkin.js"),
          ]);
        const TOKEN = "CC6LHLBJE6AZDDME2XMQAVXNNHOLEOJMXRDTENX2I4XI6FKETWJNSLD4";
        const addrF = (addressToField as (a: string) => bigint)(TOKEN);
        const keys = (deriveKeys as (s: bigint, f: bigint) => unknown)((randomScalar as () => bigint)(), addrF);

        const circuit = await (await fetch("/circuits/register.json")).json();
        const prover = new (CircuitProver as new (c: unknown) => { prove: (i: unknown) => Promise<{ proof: Uint8Array }> })(circuit);
        const w = (buildRegisterWitness as (k: unknown) => { inputs: unknown })(keys);
        const t0 = performance.now();
        const { proof } = await prover.prove(w.inputs);
        const ms = Math.round(performance.now() - t0);

        // also exercise a Grumpkin point op (Pedersen-style) to confirm the curve works in-browser
        const pt = (G as { multiply: (n: bigint) => { toAffine: () => { x: bigint } } }).multiply(12345n).toAffine();
        const okCurve = typeof pt.x === "bigint";
        const okZero = !!(Grumpkin as { ZERO: unknown }).ZERO;
        void buildTransferWitness;

        setOut(`OZ SDK in-browser OK — register proof ${proof.length} bytes in ${ms}ms; Grumpkin point op ${okCurve && okZero ? "OK" : "BAD"}\nDONE`);
      } catch (e) {
        setOut("ERR " + ((e as Error).message || String(e)));
      }
    })();
  }, []);
  return <pre id="result" style={{ padding: 16, fontSize: 12 }}>{out}</pre>;
}
