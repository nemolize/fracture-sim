import { expect, it } from "vitest";

import {
  type ContactLoad,
  contactStiffness,
  FLAT_CONCENTRATION,
  griffithStress,
  localElasticEnergy,
  MIN_PATCH_FRACTION,
  peakForce,
  POINT_CONCENTRATION,
  ringExtent,
  sameStrength,
  type StrengthModel,
  tensileStress,
  tensionConcentration,
  usableCrackEnergy,
} from "./contact-stress";

const BODY = 0.5;
const THICKNESS = 0.01;
const load = (patchWidth: number): ContactLoad => ({
  impulse: 2,
  effectiveMass: 0.5,
  patchWidth,
  bodyWidth: BODY,
  bodyDepth: BODY,
});
const strength: StrengthModel = {
  youngModulusPa: 70e9,
  tensileStrengthPa: 10e6,
  thicknessM: THICKNESS,
  crush: null,
};

it("sizes the peak force of a half-sine pulse from the impulse and the contact spring", () => {
  expect(peakForce(2, 2e6, 0.5)).toBeCloseTo(2000, 9);
});

it("starts a crack for a hard contact and not for a soft one of the same impulse", () => {
  const hard = tensileStress(load(0.01), 2e6, THICKNESS);
  const soft = tensileStress(load(0.01), 0.5e6, THICKNESS);
  expect(hard / soft).toBeCloseTo(2, 12);
  const threshold = Math.sqrt(hard * soft);
  expect(hard).toBeGreaterThanOrEqual(threshold);
  expect(soft).toBeLessThan(threshold);
});

it("stresses a point contact far more than a flat edge of the same impulse and stiffness", () => {
  const flat = tensileStress(load(BODY), 2e6, THICKNESS);
  const point = tensileStress(load(BODY * MIN_PATCH_FRACTION), 2e6, THICKNESS);
  expect(point / flat).toBeGreaterThan(
    POINT_CONCENTRATION / FLAT_CONCENTRATION,
  );
  expect(tensionConcentration(BODY, BODY)).toBe(FLAT_CONCENTRATION);
  expect(tensionConcentration(2 * BODY, BODY)).toBe(FLAT_CONCENTRATION);
  expect(tensionConcentration(0, BODY)).toBe(POINT_CONCENTRATION);
});

it("loads the body to the shallower of its depth and the patch width", () => {
  expect(contactStiffness(1e9, THICKNESS, load(0.1))).toBeCloseTo(
    1e9 * THICKNESS,
    3,
  );
  expect(
    contactStiffness(1e9, THICKNESS, { ...load(0.4), bodyDepth: 0.2 }),
  ).toBeCloseTo((1e9 * THICKNESS * 0.4) / 0.2, 3);
});

it("divides the Griffith stress by the square root of two when the flaw doubles", () => {
  const a0 = 0.003;
  const single = griffithStress(70e9, 7, a0);
  expect(griffithStress(70e9, 7, 2 * a0)).toBeCloseTo(single / Math.SQRT2, 3);
  expect(griffithStress(70e9, 7, 4 * a0)).toBeCloseTo(single / 2, 3);
  const stress = 0.8 * single;
  expect(stress).toBeLessThan(single);
  expect(stress).toBeGreaterThanOrEqual(griffithStress(70e9, 7, 2 * a0));
});

it("stores elastic energy as stress squared over twice the modulus, per volume", () => {
  expect(localElasticEnergy(10, 2, 3)).toBe(75);
});

it("makes no crack energy usable unless the contact stress reaches the tensile strength", () => {
  const edge = load(BODY);
  const corner = load(BODY * MIN_PATCH_FRACTION);
  const weak = { ...strength, tensileStrengthPa: 1e12 };
  expect(usableCrackEnergy(corner, weak, 7, 5)).toBe(0);
  expect(usableCrackEnergy(corner, strength, 7, 5)).toBeGreaterThan(0);
  const tough = {
    ...strength,
    tensileStrengthPa: tensileStress(
      edge,
      contactStiffness(strength.youngModulusPa, THICKNESS, edge),
      THICKNESS,
    ),
  };
  expect(usableCrackEnergy(edge, tough, 7, 5)).toBeGreaterThan(0);
  expect(
    usableCrackEnergy(
      edge,
      { ...tough, tensileStrengthPa: tough.tensileStrengthPa * 1.01 },
      7,
      5,
    ),
  ).toBe(0);
});

it("caps the usable energy at the lost energy and at the elastic energy under the contact", () => {
  const corner = load(BODY * MIN_PATCH_FRACTION);
  const stored = usableCrackEnergy(corner, strength, 7, Infinity);
  expect(stored).toBeGreaterThan(0);
  expect(stored).toBeLessThan(Infinity);
  expect(usableCrackEnergy(corner, strength, 7, stored / 2)).toBe(stored / 2);
  expect(usableCrackEnergy(corner, strength, 7, stored * 2)).toBe(stored);
});

it("also needs the Griffith stress when the material sets a flaw length", () => {
  const corner = load(BODY * MIN_PATCH_FRACTION);
  expect(usableCrackEnergy(corner, strength, 7, 5)).toBeGreaterThan(0);
  expect(
    usableCrackEnergy(corner, { ...strength, flawLengthM: 1e-12 }, 7, 5),
  ).toBe(0);
  expect(
    usableCrackEnergy(corner, { ...strength, flawLengthM: 10 }, 7, 5),
  ).toBeGreaterThan(0);
});

it("measures a ring along and across a direction", () => {
  const ring = [
    { x: -1, y: -0.5 },
    { x: 1, y: -0.5 },
    { x: 1, y: 0.5 },
    { x: -1, y: 0.5 },
  ];
  expect(ringExtent(ring, { x: 0, y: 1 })).toEqual({ width: 2, depth: 1 });
  expect(ringExtent(ring, { x: 1, y: 0 })).toEqual({ width: 1, depth: 2 });
});

it("compares strength models by value", () => {
  const foam = {
    plateauStressPa: 1,
    densificationStrain: 0.6,
    densifiedModulusPa: 5,
    crushDepthM: 0.02,
  };
  const model = { ...strength, crush: foam };
  expect(sameStrength(model, model)).toBe(true);
  expect(sameStrength(undefined, undefined)).toBe(true);
  expect(sameStrength(model, undefined)).toBe(false);
  expect(sameStrength(undefined, model)).toBe(false);
  expect(sameStrength(model, { ...model, crush: { ...foam } })).toBe(true);
  expect(sameStrength(strength, { ...strength })).toBe(true);
  expect(sameStrength(model, strength)).toBe(false);
  expect(sameStrength(strength, model)).toBe(false);
  for (const patch of [
    { youngModulusPa: 1 },
    { tensileStrengthPa: 1 },
    { thicknessM: 1 },
    { flawLengthM: 1 },
  ])
    expect(sameStrength(strength, { ...strength, ...patch })).toBe(false);
  for (const patch of [
    { plateauStressPa: 2 },
    { densificationStrain: 0.5 },
    { densifiedModulusPa: 6 },
    { crushDepthM: 0.03 },
  ])
    expect(
      sameStrength(model, { ...model, crush: { ...foam, ...patch } }),
    ).toBe(false);
});
