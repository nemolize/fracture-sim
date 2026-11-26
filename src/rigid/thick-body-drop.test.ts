/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import { afterEach, beforeAll, expect, it, vi } from "vitest";

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

const place = (object: MaterialSettings, height: number, tilt = 0) => {
  const placed = new RigidWorld(
    DEFAULT_ENVIRONMENT,
    { width: SIDE, height: SIDE },
    "rectangle",
    { floor: CONCRETE_FLOOR, object },
  );
  world = placed;
  const plate = placed["shapes"][4];
  if (plate === undefined) throw new Error("Missing plate");
  const lowest = (SIDE / 2) * (Math.cos(tilt) + Math.sin(Math.abs(tilt)));
  plate.body.setRotation(tilt, true);
  plate.body.setTranslation({ x: 5, y: lowest + height }, true);
  plate.body.setLinvel({ x: 0, y: 0 }, true);
  placed["world"].propagateModifiedBodyPositionsToColliders();
  return { placed, plate };
};

const settle = (placed: RigidWorld, steps = 120): void => {
  for (let i = 0; i < steps; i++)
    placed.advance(TIME_STEP, { x: 0, y: -GRAVITY });
};

const drop = (
  object: MaterialSettings,
  height: number,
  tilt = 0,
): RigidWorld => {
  const { placed } = place(object, height, tilt);
  settle(placed);
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

it.each([1, 5])(
  "keeps the 180 mm polystyrene plate whole when it lands tilted by %s degrees",
  (degrees) => {
    expect(
      drop(
        material("polystyrene", 180),
        1,
        (degrees * Math.PI) / 180,
      ).snapshot().stats.bodies,
    ).toBe(1);
  },
);

it("keeps the thickest plate the sliders reach, 100 mm of polystyrene, whole in a 1 m flat drop", () => {
  expect(drop(material("polystyrene", 100), 1).snapshot().stats.bodies).toBe(1);
});

it("still breaks the same plate in glass in a 1 m flat drop", () => {
  expect(
    drop(material("glass", 10), 1).snapshot().stats.bodies,
  ).toBeGreaterThan(1);
});

it("splits the 180 mm polystyrene plate into 4 bodies in a 1 m corner drop, as recorded in docs/material-presets.md", () => {
  expect(
    drop(material("polystyrene", 180), 1, Math.PI / 4).snapshot().stats.bodies,
  ).toBe(4);
});

it("absorbs a 1 m drop of an expanded polystyrene plate by crushing, stiffening the same spot on a second hit", () => {
  const eps = material("eps", 10);
  const { placed, plate } = place(eps, 1);
  let first = placed["fracture"].lastCrush.get(plate);
  for (let i = 0; i < 120 && first === undefined; i++) {
    settle(placed, 1);
    first = placed["fracture"].lastCrush.get(plate);
  }
  if (first === undefined) throw new Error("The plate never touched down");
  const foam = eps.crush;
  if (foam === null) throw new Error("Missing foam properties");
  const freshStiffness = segmentStiffness(
    0,
    foam,
    eps.youngModulusPa,
    (eps.thicknessMm / 1000) * SIDE,
    foam.crushDepthM,
  );
  expect(first.stiffness / freshStiffness).toBeCloseTo(1, 5);
  settle(placed);
  expect(placed.snapshot().stats.bodies).toBe(1);
  expect([...placed["fracture"].compression(plate).keys()]).toContain(
    first.cell,
  );
  plate.body.setTranslation({ x: 5, y: SIDE / 2 + 1 }, true);
  plate.body.setLinvel({ x: 0, y: 0 }, true);
  placed["world"].propagateModifiedBodyPositionsToColliders();
  settle(placed);
  const second = placed["fracture"].lastCrush.get(plate);
  expect(second?.cell).toBe(first.cell);
  expect(second?.stiffness).toBeGreaterThan(first.stiffness);
  expect(placed.snapshot().stats.bodies).toBe(1);
});

it("reports no compression for a body that never touched anything", () => {
  const placed = new RigidWorld(DEFAULT_ENVIRONMENT);
  world = placed;
  const plate = placed["shapes"][4];
  if (plate === undefined) throw new Error("Missing plate");
  expect(placed["fracture"].compression(plate).size).toBe(0);
});

it("evaluates a compound-collider foam body once per contact pair, from the pair's whole impulse and span", () => {
  const placed = new RigidWorld(
    { ...DEFAULT_ENVIRONMENT, width: 30, height: 20 },
    { width: 9.9, height: 0.1 },
    "ellipse",
    { floor: CONCRETE_FLOOR, object: material("eps", 10) },
  );
  world = placed;
  const plate = placed["shapes"][4];
  if (plate === undefined) throw new Error("Missing plate");
  plate.body.setTranslation({ x: 15, y: 1 }, true);
  placed["world"].propagateModifiedBodyPositionsToColliders();
  const crush = vi.spyOn(placed["fracture"].lastCrush, "set");
  const load = vi.spyOn(placed["fracture"], "contactLoad");
  let most = 0;
  let widest = 0;
  for (let i = 0; i < 120; i++) {
    crush.mockClear();
    load.mockClear();
    placed.advance(TIME_STEP, { x: 0, y: -GRAVITY });
    most = Math.max(most, crush.mock.calls.length);
    for (const [, hit] of load.mock.calls) widest = Math.max(widest, hit.span);
    expect(
      new Set(load.mock.calls.map(([, hit]) => hit.impulse)).size,
    ).toBeLessThanOrEqual(1);
  }
  expect(most).toBe(1);
  expect(widest).toBeGreaterThan(2);
});

it("rejects a non-positive fracture energy or strength value and cancels a queued split when the strength changes", () => {
  const placed = new RigidWorld(DEFAULT_ENVIRONMENT);
  world = placed;
  const fracture = placed["fracture"];
  const strength = placed["live"].strength;
  expect(() => {
    fracture.setStrength(0, strength);
  }).toThrow("Fracture energy must be positive and finite");
  for (const patch of [
    { youngModulusPa: 0 },
    { tensileStrengthPa: NaN },
    { thicknessM: -1 },
  ])
    expect(() => {
      fracture.setStrength(7, { ...strength, ...patch });
    }).toThrow("Strength model values must be positive and finite");
  const plate = placed["shapes"][4];
  if (plate === undefined) throw new Error("Missing plate");
  fracture["pending"].set(plate, { kind: "split", pieces: [] });
  fracture.setStrength(7, { ...strength });
  expect(fracture["pending"].size).toBe(1);
  fracture.setStrength(7, { ...strength, tensileStrengthPa: 1 });
  expect(fracture["pending"].size).toBe(0);
});
