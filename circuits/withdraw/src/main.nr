//! Confidential Payroll - withdraw circuit.
//!
//! Employee withdraws a revealed amount `w` from their confidential balance, proving
//! WITHOUT revealing the balance:
//!   1. ownership:   knows sk, bal with  C2 == bal*G + sk*C1   (EC-ElGamal)
//!   2. solvency:    0 <= w <= bal  (40-bit range on bal, w, bal-w)
//!   3. new balance: outputs C' = ElGamal(bal-w, pk, r_new)
//!
//! Inputs are plain Field coords (not EmbeddedCurvePoint) so the public-input layout is
//! exactly 4 coord fields + w, matching the contract's 128-byte stored ciphertext format.
//!
//! Public inputs:  c1x, c1y, c2x, c2y, w            (5 fields)
//! Public outputs: c1p.x, c1p.y, c2p.x, c2p.y       (4 fields)  => 9 fields, 288 bytes.

use std::embedded_curve_ops::{
    EmbeddedCurvePoint, EmbeddedCurveScalar, fixed_base_scalar_mul, multi_scalar_mul,
};

fn main(
    c1x: pub Field,
    c1y: pub Field,
    c2x: pub Field,
    c2y: pub Field,
    w: pub Field,   // withdraw amount (revealed - paid out as public USDC)
    sk: Field,      // private: employee secret key
    bal: Field,     // private: current plaintext balance
    r_new: Field,   // private: randomness for new balance ciphertext
) -> pub [Field; 4] {
    let c1 = EmbeddedCurvePoint { x: c1x, y: c1y, is_infinite: false };
    let sk_s = EmbeddedCurveScalar::from_field(sk);

    // 1) ownership + balance correctness: C2 == bal*G + sk*C1
    bal.assert_max_bit_size::<40>();
    let bal_s = EmbeddedCurveScalar::from_field(bal);
    let recovered = fixed_base_scalar_mul(bal_s) + multi_scalar_mul([c1], [sk_s]);
    assert(recovered.x == c2x);
    assert(recovered.y == c2y);

    // 2) solvency: 0 <= w <= bal  (bal - w stays in 40-bit range => no underflow)
    w.assert_max_bit_size::<40>();
    let new_bal = bal - w;
    new_bal.assert_max_bit_size::<40>();

    // 3) new balance ciphertext C' = ElGamal(new_bal, pk, r_new)
    let r_s = EmbeddedCurveScalar::from_field(r_new);
    let new_s = EmbeddedCurveScalar::from_field(new_bal);
    let c1p = fixed_base_scalar_mul(r_s);
    let c2p = fixed_base_scalar_mul(new_s) + multi_scalar_mul([c1p], [sk_s]);

    [c1p.x, c1p.y, c2p.x, c2p.y]
}
