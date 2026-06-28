use std::embedded_curve_ops::{EmbeddedCurveScalar, multi_scalar_mul, fixed_base_scalar_mul};

// Minimal-public-input variant: everything is bound into ONE public hash,
// keeping on-chain UltraHonk verification within the Soroban budget.
fn main(
    amount: Field,   // private
    r: Field,        // private
    sk: Field,       // private
) -> pub Field {
    amount.assert_max_bit_size::<40>();

    let r_s   = EmbeddedCurveScalar::from_field(r);
    let amt_s = EmbeddedCurveScalar::from_field(amount);
    let sk_s  = EmbeddedCurveScalar::from_field(sk);

    let pk = fixed_base_scalar_mul(sk_s);          // PK = sk*G
    let c1 = fixed_base_scalar_mul(r_s);           // C1 = r*G
    let amount_g = fixed_base_scalar_mul(amt_s);   // amount*G
    let r_pk = multi_scalar_mul([pk], [r_s]);      // r*PK
    let c2 = amount_g + r_pk;                       // C2 = amount*G + r*PK
    let commitment = std::hash::pedersen_hash([amount, r]);

    // bind the full public statement into a single field element
    std::hash::pedersen_hash([pk.x, pk.y, c1.x, c1.y, c2.x, c2.y, commitment])
}
