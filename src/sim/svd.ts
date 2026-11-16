/**
 * Signed 2x2 SVD, F = U diag(s1, s2) V^T with U and V rotations and s1 >= s2.
 * s2 is negative when F inverts the element. Writes [cu, su, cv, sv, s1, s2]
 * into `out`, where (cu, su) and (cv, sv) are the cosine and sine of U and V.
 */
export const svd2 = (
  f00: number,
  f01: number,
  f10: number,
  f11: number,
  out: Float64Array,
): void => {
  const x = f00 + f11;
  const y = f10 - f01;
  const r = Math.sqrt(x * x + y * y);
  const c = r > 0 ? x / r : 1;
  const s = r > 0 ? y / r : 0;
  // S = R^T F is symmetric, so diagonalise it with one more rotation Q.
  const a = c * f00 + s * f10;
  const d = -s * f01 + c * f11;
  const b = (c * f01 + s * f11 - s * f00 + c * f10) / 2;
  const m = a - d;
  const spread = Math.sqrt(m * m + 4 * b * b);
  const ct = spread > 0 ? Math.sqrt((1 + m / spread) / 2) : 1;
  const st =
    spread > 0 ? Math.sign(b || 1) * Math.sqrt((1 - m / spread) / 2) : 0;
  const mean = (a + d) / 2;
  out[0] = c * ct - s * st;
  out[1] = s * ct + c * st;
  out[2] = ct;
  out[3] = st;
  out[4] = mean + spread / 2;
  out[5] = mean - spread / 2;
};
