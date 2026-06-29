//! Confidential Payroll - withdraw circuit v2: viewing key != spending key.
//!
//! Separates two roles (the key production-readiness fix):
//!   - VIEWING key (vk): decrypts the balance. Shareable with an auditor (read-only).
//!   - SPENDING key (sk_spend): authorizes withdrawal. Never shared.
//!
//! The balance is ElGamal-encrypted under pk_view = vk*G. The withdrawal is bound to the
//! registered owner pk_spend = sk_spend*G. An auditor holding vk can decrypt (read) but
//! CANNOT withdraw, because withdrawal requires knowledge of sk_spend.
//!
//! Public inputs: c1x,c1y, c2x,c2y, pk_spend_x,pk_spend_y, w   (7)
//! Public outputs: c1p.x,c1p.y, c2p.x,c2p.y                    (4)  => 11 fields.

use std::embedded_curve_ops::{
    EmbeddedCurvePoint, EmbeddedCurveScalar, fixed_base_scalar_mul, multi_scalar_mul,
};

fn main(
    c1x: pub Field,
    c1y: pub Field,
    c2x: pub Field,
    c2y: pub Field,
    pk_spend_x: pub Field, // registered owner (spend pubkey)
    pk_spend_y: pub Field,
    w: pub Field,
    vk: Field,       // private: VIEWING key (decrypts balance)
    sk_spend: Field, // private: SPENDING key (authorizes withdrawal)
    bal: Field,      // private: current plaintext balance
    r_new: Field,    // private: randomness for new ciphertext
) -> pub [Field; 4] {
    // 1) authorization: prove knowledge of the SPENDING key for the registered owner.
    let pk = fixed_base_scalar_mul(EmbeddedCurveScalar::from_field(sk_spend));
    assert(pk.x == pk_spend_x);
    assert(pk.y == pk_spend_y);

    // 2) read the balance with the VIEWING key: C2 == bal*G + vk*C1
    let c1 = EmbeddedCurvePoint { x: c1x, y: c1y, is_infinite: false };
    bal.assert_max_bit_size::<40>();
    let vk_s = EmbeddedCurveScalar::from_field(vk);
    let recovered =
        fixed_base_scalar_mul(EmbeddedCurveScalar::from_field(bal)) + multi_scalar_mul([c1], [vk_s]);
    assert(recovered.x == c2x);
    assert(recovered.y == c2y);

    // 3) solvency: 0 <= w <= bal
    w.assert_max_bit_size::<40>();
    let new_bal = bal - w;
    new_bal.assert_max_bit_size::<40>();

    // 4) new balance ciphertext under pk_view (= vk*G): C1'=r_new*G, C2'=(bal-w)*G + vk*C1'
    let c1p = fixed_base_scalar_mul(EmbeddedCurveScalar::from_field(r_new));
    let c2p = fixed_base_scalar_mul(EmbeddedCurveScalar::from_field(new_bal))
        + multi_scalar_mul([c1p], [vk_s]);

    [c1p.x, c1p.y, c2p.x, c2p.y]
}
