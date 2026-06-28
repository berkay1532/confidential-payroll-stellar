// Trivial circuit for Gate 1: prove knowledge of x such that x*x == y (public).
fn main(x: Field, y: pub Field) {
    assert(x * x == y);
}
