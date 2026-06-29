//! Confidential Payroll - batch circuit v2 (viewing key != spending key).
//!
//! Each amount is ElGamal-encrypted under the recipient's VIEWING pubkey (pk_view), and the
//! recipient's SPENDING pubkey (pk_spend) is published so the contract stores the owner. An
//! auditor with vk can decrypt; only the sk_spend holder can later withdraw.
//!
//! Public output per recipient (6 fields): c1.x, c1.y, c2.x, c2.y, pk_spend.x, pk_spend.y
//! followed by total (1 field)  =>  6*N + 1.

use std::embedded_curve_ops::{EmbeddedCurvePoint, EmbeddedCurveScalar, fixed_base_scalar_mul, multi_scalar_mul};

global N: u32 = 4;

fn main(
    amounts: [Field; N],     // private: salaries
    rs: [Field; N],          // private: encryption randomness
    pk_view_x: [Field; N],   // recipient viewing pubkeys (encrypt under these)
    pk_view_y: [Field; N],
    pk_spend_x: [Field; N],  // recipient spending pubkeys (published -> stored as owner)
    pk_spend_y: [Field; N],
) -> pub [Field; 6 * N + 1] {
    let mut out: [Field; 6 * N + 1] = [0; 6 * N + 1];
    let mut total: Field = 0;

    for i in 0..N {
        amounts[i].assert_max_bit_size::<40>();
        total += amounts[i];

        let r_s = EmbeddedCurveScalar::from_field(rs[i]);
        let a_s = EmbeddedCurveScalar::from_field(amounts[i]);
        let pk_view = EmbeddedCurvePoint { x: pk_view_x[i], y: pk_view_y[i], is_infinite: false };

        // C1 = r*G ; C2 = amount*G + r*pk_view
        let c1 = fixed_base_scalar_mul(r_s);
        let c2 = fixed_base_scalar_mul(a_s) + multi_scalar_mul([pk_view], [r_s]);

        let b = 6 * i;
        out[b] = c1.x;
        out[b + 1] = c1.y;
        out[b + 2] = c2.x;
        out[b + 3] = c2.y;
        out[b + 4] = pk_spend_x[i];
        out[b + 5] = pk_spend_y[i];
    }
    out[6 * N] = total;
    out
}
