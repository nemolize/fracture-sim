/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import { afterEach, beforeAll, expect, it } from "vitest";

import { segmentStiffness } from "@/sim/crush";
import { FLOOR_PRESETS, floorFromPreset } from "@/sim/floor-material";
import {
  DEFAULT_MATERIAL,
  findMaterialPreset,
  materialFromPreset,
  type MaterialSettings,
} from "@/sim/material";

import { GRAVITY, TIME_STEP } from "./constants";
import { DEFAULT_ENVIRONMENT } from "./environment";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});

const SIDE = 0.5;
const ZERO_FOAM = {
  plateauStressPa: 1,
  densificationStrain: 1,
  densifiedModulusPa: 1,
  crushDepthM: 1,
};
const CONCRETE_FLOOR = (() => {
  const preset = FLOOR_PRESETS.find(({ id }) => id === "concrete");
  if (preset === undefined) throw new Error("Missing concrete floor preset");
  return floorFromPreset(preset);
})();

const material = (id: string, thicknessMm: number): MaterialSettings => {
  const preset = findMaterialPreset(id);
  if (preset === undefined) throw new Error("Missing preset");
  return materialFromPreset(preset, { ...DEFAULT_MATERIAL, thicknessMm });
};

const drop = (
  object: MaterialSettings,
  height: number,
  corner = false,
): RigidWorld => {
  const placed = new RigidWorld(
    DEFAULT_ENVIRONMENT,
    { width: SIDE, height: SIDE },
    "rectangle",
    { floor: CONCRETE_FLOOR, object },
  );
  world = placed;
  const plate = placed["shapes"][4];
  if (plate === undefined) throw new Error("Missing plate");
  const lowest = corner ? (SIDE * Math.SQRT2) / 2 : SIDE / 2;
  plate.body.setRotation(corner ? Math.PI / 4 : 0, true);
  plate.body.setTranslation({ x: 5, y: lowest + height }, true);
  placed["world"].propagateModifiedBodyPositionsToColliders();
  for (let i = 0; i < 120; i++)
    placed.advance(TIME_STEP, { x: 0, y: -GRAVITY });
  return placed;
};

it.each([0.3, 1])(
  "keeps a 180 mm solid polystyrene plate whole in a %s m flat drop onto concrete",
  (height) => {
    expect(
      drop(material("polystyrene", 180), height).snapshot().stats.bodies,
    ).toBe(1);
  },
);

it("still breaks the same plate in glass in a 1 m flat drop", () => {
  expect(
    drop(material("glass", 10), 1).snapshot().stats.bodies,
  ).toBeGreaterThan(1);
});

it("splits the 180 mm polystyrene plate into 4 bodies in a 1 m corner drop, as recorded in docs/material-presets.md", () => {
  expect(
    drop(material("polystyrene", 180), 1, true).snapshot().stats.bodies,
  ).toBe(4);
});

it("absorbs a 1 m drop of an expanded polystyrene plate by crushing, stiffening the same spot on a second hit", () => {
  const placed = drop(material("eps", 10), 1);
  const plate = placed["shapes"][4];
  if (plate === undefined) throw new Error("Missing plate");
  expect(placed.snapshot().stats.bodies).toBe(1);
  const crushed = [...placed["fracture"].compression(plate)];
  expect(crushed.length).toBeGreaterThan(0);
  const [cell, compression] = crushed[0] ?? ["", 0];
  expect(compression).toBeGreaterThan(0);
  const first = placed["fracture"].lastCrush.get(plate);
  plate.body.setTranslation({ x: 5, y: 0.25 + 1 }, true);
  plate.body.setLinvel({ x: 0, y: 0 }, true);
  plate.body.setRotation(0, true);
  placed["world"].propagateModifiedBodyPositionsToColliders();
  for (let i = 0; i < 120; i++)
    placed.advance(TIME_STEP, { x: 0, y: -GRAVITY });
  const second = placed["fracture"].lastCrush.get(plate);
  expect(second?.cell).toBe(first?.cell);
  expect(first?.cell).toBe(cell);
  const eps = material("eps", 10);
  const freshStiffness = segmentStiffness(
    0,
    eps.crush ?? { ...ZERO_FOAM },
    eps.youngModulusPa,
    0.01 * SIDE,
    eps.crush?.crushDepthM ?? 1,
  );
  expect(second?.stiffness).toBeGreaterThan(freshStiffness);
  expect(placed.snapshot().stats.bodies).toBe(1);
});

it("reports no compression for a body that never touched anything", () => {
  const placed = new RigidWorld(DEFAULT_ENVIRONMENT);
  world = placed;
  const plate = placed["shapes"][4];
  if (plate === undefined) throw new Error("Missing plate");
  expect(placed["fracture"].compression(plate).size).toBe(0);
});
