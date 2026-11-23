import { expect, it } from "vitest";

import {
  AREAL_DENSITY_RANGE,
  arealDensity,
  crackEnergy,
  DEFAULT_CRACK_ENERGY,
  DEFAULT_MATERIAL,
  findMaterialPreset,
  fractureEnergyAt,
  liveMaterials,
  MATERIAL_PRESETS,
  MATERIAL_RANGES,
  materialFromPreset,
  SURFACE_RANGES,
  validateMaterial,
  validateSurface,
} from "./material";

it.each([
  ["glass", 7, 0.07],
  ["ice", 1.5, 0.015],
  ["pmma", 500, 5],
  ["polystyrene", 400, 4],
] as const)(
  "uses sourced fracture energy for %s and converts a 10 mm plate",
  (id, energy, lineEnergy) => {
    const preset = findMaterialPreset(id);
    if (preset === undefined) throw new Error("Missing preset");
    const material = materialFromPreset(preset, DEFAULT_MATERIAL);
    expect(material.fractureEnergy).toBe(energy);
    expect(crackEnergy(material)).toBeCloseTo(lineEnergy, 14);
    expect(crackEnergy({ ...material, thicknessMm: 20 })).toBeCloseTo(
      2 * lineEnergy,
      14,
    );
  },
);

it("starts as glass, with the density, friction and restitution the app had before", () => {
  expect(DEFAULT_MATERIAL).toEqual({
    preset: "glass",
    fractureEnergy: 7,
    density: 2500,
    friction: 0.5,
    restitution: 0,
    thicknessMm: 10,
    minFragmentArea: 0.01,
  });
  expect(arealDensity(DEFAULT_MATERIAL)).toBe(25);
  expect(DEFAULT_CRACK_ENERGY).toBeCloseTo(0.07, 14);
});

it("keeps the thickness of the specimen when a preset is chosen", () => {
  const ice = findMaterialPreset("ice");
  if (ice === undefined) throw new Error("Missing preset");
  expect(
    materialFromPreset(ice, { ...DEFAULT_MATERIAL, thicknessMm: 3 }),
  ).toEqual({
    preset: "ice",
    fractureEnergy: 1.5,
    density: 917,
    friction: 0.1,
    restitution: 0.05,
    thicknessMm: 3,
    minFragmentArea: 0.01,
  });
  expect(findMaterialPreset("unknown")).toBeUndefined();
});

it("derives areal density from volumetric density and thickness", () => {
  expect(
    arealDensity({ ...DEFAULT_MATERIAL, density: 1000, thicknessMm: 50 }),
  ).toBe(50);
});

it("accepts every density and thickness slider position", () => {
  for (const density of [
    MATERIAL_RANGES.density.min,
    MATERIAL_RANGES.density.max,
  ])
    for (const thicknessMm of [
      MATERIAL_RANGES.thicknessMm.min,
      MATERIAL_RANGES.thicknessMm.max,
    ])
      expect(() => {
        validateMaterial({ ...DEFAULT_MATERIAL, density, thicknessMm });
      }).not.toThrow();
  expect(AREAL_DENSITY_RANGE.min).toBeLessThanOrEqual(
    (MATERIAL_RANGES.density.min * MATERIAL_RANGES.thicknessMm.min) / 1000,
  );
  expect(AREAL_DENSITY_RANGE.max).toBeGreaterThanOrEqual(
    (MATERIAL_RANGES.density.max * MATERIAL_RANGES.thicknessMm.max) / 1000,
  );
});

it("keeps every preset valid at the default thickness", () => {
  for (const preset of MATERIAL_PRESETS)
    expect(() => {
      validateMaterial(materialFromPreset(preset, DEFAULT_MATERIAL));
    }).not.toThrow();
});

it.each([
  [{ density: 1 }, "Invalid material setting: areal density"],
  [{ density: 1e6 }, "Invalid material setting: areal density"],
  [{ thicknessMm: NaN }, "Invalid material setting: areal density"],
  [{ friction: 2.1 }, "Invalid material setting: friction"],
  [{ restitution: -0.1 }, "Invalid material setting: restitution"],
  [{ fractureEnergy: 0 }, "Fracture energy must be positive and finite"],
] as const)("rejects the invalid material %j", (patch, message) => {
  expect(() => {
    validateMaterial({ ...DEFAULT_MATERIAL, ...patch });
  }).toThrow(message);
});

it.each([
  ["friction", SURFACE_RANGES.friction],
  ["restitution", SURFACE_RANGES.restitution],
] as const)("bounds %s to its range", (key, { min, max }) => {
  for (const value of [min, max])
    expect(() => {
      validateSurface({ friction: 0.5, restitution: 0, [key]: value });
    }).not.toThrow();
  for (const value of [min - 0.01, max + 0.01, NaN, Infinity])
    expect(() => {
      validateSurface({ friction: 0.5, restitution: 0, [key]: value });
    }).toThrow(`Invalid material setting: ${key}`);
});

it.each([0, -1, NaN, Infinity, -Infinity])(
  "rejects invalid thickness %s",
  (thicknessMm) => {
    expect(() => crackEnergy({ ...DEFAULT_MATERIAL, thicknessMm })).toThrow(
      "Thickness and crack energy must be positive and finite",
    );
  },
);

it("rejects unrepresentable conversions", () => {
  expect(() =>
    crackEnergy({
      ...DEFAULT_MATERIAL,
      fractureEnergy: Number.MIN_VALUE,
      thicknessMm: Number.MIN_VALUE,
    }),
  ).toThrow("Thickness and crack energy must be positive and finite");
  expect(() =>
    crackEnergy({
      ...DEFAULT_MATERIAL,
      fractureEnergy: Number.MAX_VALUE,
      thicknessMm: Number.MAX_VALUE,
    }),
  ).toThrow("Thickness and crack energy must be positive and finite");
});

it("derives what the world reads each frame from the two materials", () => {
  const object = {
    ...DEFAULT_MATERIAL,
    thicknessMm: 20,
    minFragmentArea: 0.01,
  };
  const floor = { preset: "custom" as const, friction: 1, restitution: 0.5 };
  expect(liveMaterials({ floor, object })).toEqual({
    crackEnergy: crackEnergy(object),
    minFragmentArea: 0.01,
    floor,
    object,
  });
});

it("snaps a slider position next to a preset's fracture energy to it", () => {
  expect(fractureEnergyAt(0.85)).toBe(7);
  expect(fractureEnergyAt(0.18)).toBe(1.5);
  expect(fractureEnergyAt(1)).toBe(10);
});
