/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import { afterEach, beforeAll, expect, it } from "vitest";

import { fillBodyPool, parkBalls } from "./body-pool";
import { TIME_STEP } from "./constants";
import { DEFAULT_ENVIRONMENT } from "./environment";
import { MAX_BODIES } from "./fracture";
import { objectUnit } from "./object-size";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});

const MINIMUM_SIZE = {
  width: objectUnit(DEFAULT_ENVIRONMENT),
  height: objectUnit(DEFAULT_ENVIRONMENT),
};

const advance = (seconds: number) => {
  for (let i = 0; i < seconds / TIME_STEP; i++)
    world?.advance(TIME_STEP, { x: 0, y: -DEFAULT_ENVIRONMENT.gravity });
};

const dropMinimumPlate = (height: number) => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, MINIMUM_SIZE);
  const plate = world["shapes"].find((shape) => !shape.fixed);
  plate?.body.setTranslation(
    { x: 5, y: MINIMUM_SIZE.height / 2 + height },
    true,
  );
  world["world"].propagateModifiedBodyPositionsToColliders();
  advance(1.5);
  return { plate, snapshot: world.snapshot() };
};

it("keeps a minimum-size plate that lands below the crack threshold", () => {
  const { plate, snapshot } = dropMinimumPlate(0.001);
  expect(plate !== undefined && world?.["shapes"].includes(plate)).toBe(true);
  expect(snapshot.stats.bodies).toBe(1);
  expect(snapshot.particles.length).toBe(0);
});

it("turns a minimum-size plate that lands above the crack threshold into one particle", () => {
  const { plate, snapshot } = dropMinimumPlate(0.5);
  expect(plate !== undefined && world?.["shapes"].includes(plate)).toBe(false);
  expect(snapshot.stats.bodies).toBe(0);
  expect(snapshot.stats.mass).toBe(0);
  expect(snapshot.particles.length / 4).toBe(1);
});

it("shatters a minimum-size plate even when the body pool is full", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, MINIMUM_SIZE);
  const plate = world["shapes"].find((shape) => !shape.fixed);
  plate?.body.setTranslation({ x: 5, y: 3 }, true);
  fillBodyPool(world);
  parkBalls(world);
  expect(world.snapshot().stats.bodies).toBe(MAX_BODIES);
  advance(1.5);
  expect(plate !== undefined && world["shapes"].includes(plate)).toBe(false);
  expect(world.snapshot().stats.bodies).toBe(MAX_BODIES - 1);
});
