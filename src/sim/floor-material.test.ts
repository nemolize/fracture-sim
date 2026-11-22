import { expect, it } from "vitest";

import {
  DEFAULT_FLOOR_MATERIAL,
  findFloorPreset,
  FLOOR_PRESETS,
  floorFromPreset,
} from "./floor-material";
import { validateSurface } from "./material";

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
