import { at, atByte, atInt } from "./array";
import { type Material, MIN_STRETCH, VISCOSITY_PER_YOUNGS } from "./materials";
import type { Solid } from "./solid";
import { svd2 } from "./svd";

const scratch = new Float64Array(6);

/** Removes a triangle from the simulation and gives its mass back. */
const erode = (solid: Solid, e: number, density: number): void => {
  solid.alive[e] = 0;
  const share = (density * at(solid.restArea, e)) / 3;
  for (let k = 0; k < 3; k++) {
    const n = atInt(solid.tri, 3 * e + k);
    solid.nodeRefs[n] = atInt(solid.nodeRefs, n) - 1;
    if (atInt(solid.nodeRefs, n) === 0) {
      solid.mass[n] = 0;
      solid.vx[n] = 0;
      solid.vy[n] = 0;
    } else {
      solid.mass[n] = Math.max(at(solid.mass, n) - share, share * 1e-3);
    }
  }
};

/**
 * Accumulates internal forces into `fx`/`fy`: Hencky hyperelasticity in
 * principal stretches, von Mises return mapping with linear hardening, and a
 * scalar damage that softens tension until the triangle is eroded.
 * Returns the number of triangles eroded in this call.
 */
export const addElementForces = (
  solid: Solid,
  material: Material,
  dt: number,
): number => {
  const mu = material.youngs / (2 * (1 + material.poisson));
  const lambda =
    (material.youngs * material.poisson) /
    ((1 + material.poisson) * (1 - 2 * material.poisson));
  const viscosity = VISCOSITY_PER_YOUNGS * material.youngs;
  const { x, y, vx, vy, fx, fy, tri, restInverse, plasticInverse } = solid;
  let erodedNow = 0;

  for (let e = 0; e < solid.triCount; e++) {
    if (atByte(solid.alive, e) === 0) continue;
    const i = atInt(tri, 3 * e);
    const j = atInt(tri, 3 * e + 1);
    const k = atInt(tri, 3 * e + 2);
    const b00 = at(restInverse, 4 * e);
    const b01 = at(restInverse, 4 * e + 1);
    const b10 = at(restInverse, 4 * e + 2);
    const b11 = at(restInverse, 4 * e + 3);

    // F = Ds Dm^-1, then the elastic part Fe = F Fp^-1.
    const d00 = at(x, j) - at(x, i);
    const d10 = at(y, j) - at(y, i);
    const d01 = at(x, k) - at(x, i);
    const d11 = at(y, k) - at(y, i);
    const f00 = d00 * b00 + d01 * b10;
    const f01 = d00 * b01 + d01 * b11;
    const f10 = d10 * b00 + d11 * b10;
    const f11 = d10 * b01 + d11 * b11;
    const p00 = at(plasticInverse, 4 * e);
    const p01 = at(plasticInverse, 4 * e + 1);
    const p10 = at(plasticInverse, 4 * e + 2);
    const p11 = at(plasticInverse, 4 * e + 3);
    svd2(
      f00 * p00 + f01 * p10,
      f00 * p01 + f01 * p11,
      f10 * p00 + f11 * p10,
      f10 * p01 + f11 * p11,
      scratch,
    );
    const cu = at(scratch, 0);
    const su = at(scratch, 1);
    const cv = at(scratch, 2);
    const sv = at(scratch, 3);
    const s1 = Math.max(at(scratch, 4), MIN_STRETCH);
    const s2 = Math.max(at(scratch, 5), MIN_STRETCH);
    let l1 = Math.log(s1);
    let l2 = Math.log(s2);

    let plasticStep = 0;
    const gap = l1 - l2;
    const flow =
      2 * mu * Math.abs(gap) * Math.SQRT1_2 -
      (material.yieldStress + material.hardening * at(solid.plasticStrain, e));
    if (flow > 0) {
      plasticStep = flow / (2 * mu + material.hardening);
      const shift = Math.sign(gap) * plasticStep * Math.SQRT1_2;
      l1 -= shift;
      l2 += shift;
      solid.plasticStrain[e] = at(solid.plasticStrain, e) + plasticStep;
      // Fp^-1 <- F^-1 Fe', so the next step sees the relaxed elastic part.
      const det = f00 * f11 - f01 * f10;
      if (Math.abs(det) > 1e-9) {
        const e1 = Math.exp(l1);
        const e2 = Math.exp(l2);
        const n00 = e1 * cu * cv + e2 * su * sv;
        const n01 = e1 * cu * sv - e2 * su * cv;
        const n10 = e1 * su * cv - e2 * cu * sv;
        const n11 = e1 * su * sv + e2 * cu * cv;
        plasticInverse[4 * e] = (f11 * n00 - f01 * n10) / det;
        plasticInverse[4 * e + 1] = (f11 * n01 - f01 * n11) / det;
        plasticInverse[4 * e + 2] = (-f10 * n00 + f00 * n10) / det;
        plasticInverse[4 * e + 3] = (-f10 * n01 + f00 * n11) / det;
      }
    }

    // Kirchhoff principal stresses, converted to Cauchy for the strength test.
    const trace = l1 + l2;
    const t1 = 2 * mu * l1 + lambda * trace;
    const t2 = 2 * mu * l2 + lambda * trace;
    const tensile = Math.max(t1, t2) / (s1 * s2);
    solid.stressRatio[e] = tensile / material.strength;
    let damage = at(solid.damage, e) + material.plasticDamage * plasticStep;
    if (tensile > material.strength) {
      damage += material.damageRate * (tensile / material.strength - 1) * dt;
    }
    solid.damage[e] = damage;
    if (damage >= 1) {
      erode(solid, e, material.density);
      erodedNow++;
      continue;
    }

    // Damage only softens tension, so crack faces still push back when they touch.
    const q1 = (t1 > 0 ? (1 - damage) * t1 : t1) / s1;
    const q2 = (t2 > 0 ? (1 - damage) * t2 : t2) / s2;
    const pe00 = q1 * cu * cv + q2 * su * sv;
    const pe01 = q1 * cu * sv - q2 * su * cv;
    const pe10 = q1 * su * cv - q2 * cu * sv;
    const pe11 = q1 * su * sv + q2 * cu * cv;
    let pk00 = pe00 * p00 + pe01 * p01;
    let pk01 = pe00 * p10 + pe01 * p11;
    let pk10 = pe10 * p00 + pe11 * p01;
    let pk11 = pe10 * p10 + pe11 * p11;

    // Kelvin-Voigt term on the deformation-gradient rate.
    const r00 = at(vx, j) - at(vx, i);
    const r10 = at(vy, j) - at(vy, i);
    const r01 = at(vx, k) - at(vx, i);
    const r11 = at(vy, k) - at(vy, i);
    pk00 += viscosity * (r00 * b00 + r01 * b10);
    pk01 += viscosity * (r00 * b01 + r01 * b11);
    pk10 += viscosity * (r10 * b00 + r11 * b10);
    pk11 += viscosity * (r10 * b01 + r11 * b11);

    const area = at(solid.restArea, e);
    const h00 = -area * (pk00 * b00 + pk01 * b01);
    const h01 = -area * (pk00 * b10 + pk01 * b11);
    const h10 = -area * (pk10 * b00 + pk11 * b01);
    const h11 = -area * (pk10 * b10 + pk11 * b11);
    fx[j] = at(fx, j) + h00;
    fy[j] = at(fy, j) + h10;
    fx[k] = at(fx, k) + h01;
    fy[k] = at(fy, k) + h11;
    fx[i] = at(fx, i) - h00 - h01;
    fy[i] = at(fy, i) - h10 - h11;
  }
  return erodedNow;
};
