import { expect, it } from "vitest";

import {
  crackEnergy,
  DEFAULT_MATERIAL,
  materialFractureEnergy,
} from "./material";

it.each([
  ["glass", 7, 0.07],
  ["ice", 1.5, 0.015],
  ["pmma", 500, 5],
  ["polystyrene", 400, 4],
] as const)(
  "uses sourced fracture energy for %s and converts a 10 mm plate",
  (preset, energy, lineEnergy) => {
    const material = { ...DEFAULT_MATERIAL, preset };
    expect(materialFractureEnergy(material)).toBe(energy);
    expect(crackEnergy(material)).toBeCloseTo(lineEnergy, 14);
    expect(crackEnergy({ ...material, thicknessMm: 20 })).toBeCloseTo(
      2 * lineEnergy,
      14,
    );
  },
);

it("uses a separately retained custom energy when Custom is selected", () => {
  expect(crackEnergy({ ...DEFAULT_MATERIAL, preset: "custom" })).toBe(10000);
  expect(
    crackEnergy({
      ...DEFAULT_MATERIAL,
      preset: "custom",
      customFractureEnergy: 3,
      thicknessMm: 5,
    }),
  ).toBe(0.015);
});

it.each([0, -1, NaN, Infinity, -Infinity])(
  "rejects invalid custom fracture energy %s",
  (value) => {
    expect(() =>
      crackEnergy({
        ...DEFAULT_MATERIAL,
        preset: "custom",
        customFractureEnergy: value,
      }),
    ).toThrow("Fracture energy must be positive and finite");
  },
);

it.each([0, -1, NaN, Infinity, -Infinity])(
  "rejects invalid thickness %s",
  (thicknessMm) => {
    expect(() => crackEnergy({ ...DEFAULT_MATERIAL, thicknessMm })).toThrow(
      "Thickness and crack energy must be positive and finite",
    );
  },
);

it("rejects unknown material identifiers and unrepresentable conversions", () => {
  const invalid = { ...DEFAULT_MATERIAL };
  Object.defineProperty(invalid, "preset", { value: "unknown" });
  expect(() => crackEnergy(invalid)).toThrow(
    "Fracture energy must be positive and finite",
  );
  expect(() =>
    crackEnergy({
      ...DEFAULT_MATERIAL,
      preset: "custom",
      customFractureEnergy: Number.MIN_VALUE,
      thicknessMm: Number.MIN_VALUE,
    }),
  ).toThrow("Thickness and crack energy must be positive and finite");
  expect(() =>
    crackEnergy({
      ...DEFAULT_MATERIAL,
      preset: "custom",
      customFractureEnergy: Number.MAX_VALUE,
      thicknessMm: Number.MAX_VALUE,
    }),
  ).toThrow("Thickness and crack energy must be positive and finite");
});
