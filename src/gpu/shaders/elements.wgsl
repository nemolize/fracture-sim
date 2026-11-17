// Per-triangle constitutive update: Hencky elasticity in principal stretches,
// von Mises return mapping, damage and erosion. Mirrors `addElementForces`.
// Writes the nodal forces of each triangle to `elemForce` as
// (h00, h10, h01, h11): corner j gets (h00, h10), corner k (h01, h11) and
// corner i the negated sum; the node pass gathers them.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<uniform> material: Material;
@group(0) @binding(2) var<storage, read> nodes: array<Node>;
@group(0) @binding(3) var<storage, read> elemStatic: array<ElemStatic>;
@group(0) @binding(4) var<storage, read_write> elemState: array<ElemState>;
@group(0) @binding(5) var<storage, read_write> elemForce: array<vec4<f32>>;

const SQRT1_2: f32 = 0.70710678;

// Signed 2x2 SVD, F = U diag(s1, s2) V^T. Returns (cu, su, cv, sv) in `rot`
// and (s1, s2) in `stretch`; s2 is negative when F inverts the element.
fn svd2(f: vec4<f32>, rot: ptr<function, vec4<f32>>, stretch: ptr<function, vec2<f32>>) {
  let x = f.x + f.w;
  let y = f.z - f.y;
  let r = sqrt(x * x + y * y);
  let c = select(1.0, x / r, r > 0.0);
  let s = select(0.0, y / r, r > 0.0);
  let a = c * f.x + s * f.z;
  let d = -s * f.y + c * f.w;
  let b = (c * f.y + s * f.w - s * f.x + c * f.z) / 2.0;
  let m = a - d;
  let spread = sqrt(m * m + 4.0 * b * b);
  let ct = select(1.0, sqrt(max((1.0 + m / spread) / 2.0, 0.0)), spread > 0.0);
  // Math.sign(b || 1): zero counts as positive.
  let signB = select(1.0, sign(b), b != 0.0);
  let st = select(0.0, signB * sqrt(max((1.0 - m / spread) / 2.0, 0.0)), spread > 0.0);
  let mean = (a + d) / 2.0;
  *rot = vec4<f32>(c * ct - s * st, s * ct + c * st, ct, st);
  *stretch = vec2<f32>(mean + spread / 2.0, mean - spread / 2.0);
}

// Row-major 2x2 R(u) diag(q1, q2) R(v)^T for the angles given as (cos, sin) pairs.
fn compose(rot: vec4<f32>, q1: f32, q2: f32) -> vec4<f32> {
  let cu = rot.x; let su = rot.y; let cv = rot.z; let sv = rot.w;
  return vec4<f32>(
    q1 * cu * cv + q2 * su * sv,
    q1 * cu * sv - q2 * su * cv,
    q1 * su * cv - q2 * cu * sv,
    q1 * su * sv + q2 * cu * cv,
  );
}

// Row-major 2x2 product a * b.
fn mul2(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(
    a.x * b.x + a.y * b.z,
    a.x * b.y + a.y * b.w,
    a.z * b.x + a.w * b.z,
    a.z * b.y + a.w * b.w,
  );
}

@compute @workgroup_size(64)
fn elementForces(@builtin(global_invocation_id) gid: vec3<u32>) {
  let e = gid.x;
  if (e >= params.triCount) { return; }
  var state = elemState[e];
  if (state.alive == 0u) {
    elemForce[e] = vec4<f32>(0.0);
    return;
  }
  let st = elemStatic[e];
  let ni = nodes[st.tri.x];
  let nj = nodes[st.tri.y];
  let nk = nodes[st.tri.z];
  let b = st.restInverse;

  // F = Ds Dm^-1, then the elastic part Fe = F Fp^-1.
  let d = vec4<f32>(
    nj.pos.x - ni.pos.x, nk.pos.x - ni.pos.x,
    nj.pos.y - ni.pos.y, nk.pos.y - ni.pos.y,
  );
  let f = mul2(d, b);
  let p = state.plasticInverse;
  var rot: vec4<f32>;
  var stretch: vec2<f32>;
  svd2(mul2(f, p), &rot, &stretch);
  let s1 = max(stretch.x, MIN_STRETCH);
  let s2 = max(stretch.y, MIN_STRETCH);
  var l1 = log(s1);
  var l2 = log(s2);

  var plasticStep = 0.0;
  let gap = l1 - l2;
  let flow = 2.0 * material.mu * abs(gap) * SQRT1_2
    - (material.yieldStress + material.hardening * state.plasticStrain);
  if (flow > 0.0) {
    plasticStep = flow / (2.0 * material.mu + material.hardening);
    let shift = sign(gap) * plasticStep * SQRT1_2;
    l1 -= shift;
    l2 += shift;
    state.plasticStrain += plasticStep;
    // Fp^-1 <- F^-1 Fe', so the next step sees the relaxed elastic part.
    let det = f.x * f.w - f.y * f.z;
    if (abs(det) > 1e-9) {
      let n = compose(rot, exp(l1), exp(l2));
      state.plasticInverse = vec4<f32>(
        (f.w * n.x - f.y * n.z) / det,
        (f.w * n.y - f.y * n.w) / det,
        (-f.z * n.x + f.x * n.z) / det,
        (-f.z * n.y + f.x * n.w) / det,
      );
    }
  }

  // Kirchhoff principal stresses, converted to Cauchy for the strength test.
  let trace = l1 + l2;
  let t1 = 2.0 * material.mu * l1 + material.lambda * trace;
  let t2 = 2.0 * material.mu * l2 + material.lambda * trace;
  let tensile = max(t1, t2) / (s1 * s2);
  state.stressRatio = tensile / material.strength;
  var damage = state.damage + material.plasticDamage * plasticStep;
  if (tensile > material.strength) {
    damage += material.damageRate * (tensile / material.strength - 1.0) * params.dt;
  }
  state.damage = damage;
  if (damage >= 1.0) {
    state.alive = 0u;
    elemState[e] = state;
    elemForce[e] = vec4<f32>(0.0);
    return;
  }

  // Damage only softens tension, so crack faces still push back when they touch.
  let q1 = select(t1, (1.0 - damage) * t1, t1 > 0.0) / s1;
  let q2 = select(t2, (1.0 - damage) * t2, t2 > 0.0) / s2;
  // Pe * Fp^-T, with Fp^-T the transpose of `p`.
  var pk = mul2(compose(rot, q1, q2), vec4<f32>(p.x, p.z, p.y, p.w));

  // Kelvin-Voigt term on the deformation-gradient rate.
  let r = vec4<f32>(
    nj.vel.x - ni.vel.x, nk.vel.x - ni.vel.x,
    nj.vel.y - ni.vel.y, nk.vel.y - ni.vel.y,
  );
  pk += material.viscosity * mul2(r, b);

  // h = -area * pk * b^T, row-major; columns are the forces on corners j and k.
  let h = -st.area * mul2(pk, vec4<f32>(b.x, b.z, b.y, b.w));
  elemState[e] = state;
  elemForce[e] = vec4<f32>(h.x, h.z, h.y, h.w);
}
