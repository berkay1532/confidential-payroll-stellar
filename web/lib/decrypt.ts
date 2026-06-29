// Client-side ElGamal decryption over Grumpkin (Noir's embedded curve for the BN254 backend).
// An auditor holding an employee's viewing key can decrypt that employee's on-chain balance —
// selective disclosure — while the public only sees ciphertext.
//
// NOTE (MVP simplification): here the viewing key equals the spending key (sk). A production
// design would derive a view-only key so auditors can read but not spend.

import { weierstrass } from "@noble/curves/abstract/weierstrass.js";
import { Field } from "@noble/curves/abstract/modular.js";

// Grumpkin: y^2 = x^3 - 17 over Fp (= BN254 scalar field); group order n = BN254 base field.
const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const n = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
const Fp = Field(p);

// Barretenberg's fixed Grumpkin generator (verified: sk*G == on-chain pk).
const Grumpkin = weierstrass(
  {
    p,
    n,
    h: 1n,
    a: 0n,
    b: Fp.create(-17n),
    Gx: 1n,
    Gy: 0x2cf135e7506a45d632d270d45f1181294833fc48d823f272cn,
  },
  { Fp },
);
const G = Grumpkin.BASE;

function field(hex: string, start: number): bigint {
  return BigInt("0x" + hex.slice(start, start + 64));
}

/**
 * Decrypt a 128-byte (256-hex) ElGamal ciphertext (c1.x|c1.y|c2.x|c2.y) with a viewing key.
 * Returns the cleartext amount, or null if not found within `max` (bounded discrete log).
 */
export function decryptBalance(ctHex: string, sk: bigint, max = 60000): number | null {
  if (!ctHex || ctHex.length < 256) return null;
  const C1 = Grumpkin.fromAffine({ x: field(ctHex, 0), y: field(ctHex, 64) });
  const C2 = Grumpkin.fromAffine({ x: field(ctHex, 128), y: field(ctHex, 192) });
  // M = C2 - sk*C1 = amount*G
  const M = C2.subtract(C1.multiply(sk));
  let acc = Grumpkin.ZERO;
  for (let k = 0; k <= max; k++) {
    if (acc.equals(M)) return k;
    acc = acc.add(G);
  }
  return null;
}
