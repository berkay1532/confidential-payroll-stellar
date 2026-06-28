//! Confidential Payroll - batch circuit.
//!
//! Proves a payroll run over N recipients WITHOUT revealing individual amounts:
//!   1. range:        each amount in [0, 2^40]
//!   2. conservation: revealed `total` == sum(amounts). The total is auditor-visible;
//!                    individual salaries stay hidden inside the EC-ElGamal ciphertexts.
//!   3. encryption:   each recipient ciphertext correctly encrypts its amount under pk_i
//!
//! Public outputs (consumed by the Soroban contract): per recipient
//!   pk_i.x, pk_i.y, c1_i.x, c1_i.y, c2_i.x, c2_i.y   (6 fields each)
//! followed by the revealed `total` (1 field)  =>  length 6*N + 1.
//!
//! Secrets (private): amounts, randomness, recipient secret keys.

use std::embedded_curve_ops::{EmbeddedCurveScalar, multi_scalar_mul, fixed_base_scalar_mul};

global N: u32 = 4;

fn main(
    amounts: [Field; N], // private: secret salaries
    rs: [Field; N],      // private: per-recipient encryption randomness
    sks: [Field; N],     // private: recipient secret keys (pk_i = sk_i * G)
) -> pub [Field; 6 * N + 1] {
    let mut out: [Field; 6 * N + 1] = [0; 6 * N + 1];
    let mut total: Field = 0;

    for i in 0..N {
        // range check
        amounts[i].assert_max_bit_size::<40>();
        total += amounts[i];

        let r_s = EmbeddedCurveScalar::from_field(rs[i]);
        let a_s = EmbeddedCurveScalar::from_field(amounts[i]);
        let sk_s = EmbeddedCurveScalar::from_field(sks[i]);

        // pk = sk*G ; C1 = r*G ; C2 = amount*G + r*pk   (EC-ElGamal)
        let pk = fixed_base_scalar_mul(sk_s);
        let c1 = fixed_base_scalar_mul(r_s);
        let amount_g = fixed_base_scalar_mul(a_s);
        let r_pk = multi_scalar_mul([pk], [r_s]);
        let c2 = amount_g + r_pk;

        let b = 6 * i;
        out[b]     = pk.x;
        out[b + 1] = pk.y;
        out[b + 2] = c1.x;
        out[b + 3] = c1.y;
        out[b + 4] = c2.x;
        out[b + 5] = c2.y;
    }

    // reveal the total (auditor-visible), bound to the hidden amounts
    out[6 * N] = total;
    out
}
