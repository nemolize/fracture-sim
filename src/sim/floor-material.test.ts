import { expect, it } from "vitest";

import {
  DEFAULT_FLOOR_MATERIAL,
  findFloorPreset,
  FLOOR_PRESETS,
  floorFromPreset,
  matchFloorPreset,
} from "./floor-material";
import { MATERIAL_PRESETS, validateSurface } from "./material";

it("starts with the friction 0.5 and restitution 0 the floor had before", () => {
  expect(DEFAULT_FLOOR_MATERIAL).toEqual({
    preset: "default",
    friction: 0.5,
    restitution: 0,
  });
});

it("builds a floor from a preset and keeps every preset inside the surface ranges", () => {
  const rubber = findFloorPreset("rubber");
  if (rubber === undefined) throw new Error("Missing preset");
  expect(floorFromPreset(rubber)).toEqual({
    preset: "rubber",
    friction: 1.2,
    restitution: 0.8,
  });
  expect(findFloorPreset("unknown")).toBeUndefined();
  for (const preset of FLOOR_PRESETS)
    expect(() => {
      validateSurface(preset);
    }).not.toThrow();
});

it("offers every object material as a floor with the same surface values", () => {
  for (const material of MATERIAL_PRESETS) {
    const floor = findFloorPreset(material.id);
    if (floor === undefined) throw new Error(`Missing floor ${material.id}`);
    expect(floorFromPreset(floor)).toEqual({
      preset: material.id,
      friction: material.friction,
      restitution: material.restitution,
    });
  }
});

it("keeps the chosen preset when another shares its surface values", () => {
  const polystyrene = {
    preset: "polystyrene",
    friction: 0.4,
    restitution: 0.3,
  } as const;
  expect(matchFloorPreset(polystyrene).preset).toBe("polystyrene");
  expect(matchFloorPreset({ ...polystyrene, preset: "custom" }).preset).toBe(
    "pmma",
  );
  expect(matchFloorPreset({ ...polystyrene, friction: 0.41 }).preset).toBe(
    "custom",
  );
});
