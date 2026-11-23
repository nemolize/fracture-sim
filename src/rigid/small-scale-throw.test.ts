/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import { afterEach, beforeAll, expect, it } from "vitest";

import { TIME_STEP } from "./constants";
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_WORLD_SCALE,
  withWorldScale,
  WORLD_SCALE_RANGE,
} from "./environment";
import { DEFAULT_OBJECT_SIZE, fitObjectSize } from "./object-size";
import { limitVelocity } from "./tools";
import { initializePhysics, RigidWorld } from "./world";

const MIN_FRACTURING_SCALE = 0.05;

beforeAll(initializePhysics);
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});

const plateReplacedByThrow = (scale: number): boolean => {
  const environment = withWorldScale(DEFAULT_ENVIRONMENT, scale);
  const size = fitObjectSize(DEFAULT_OBJECT_SIZE, environment);
  world = new RigidWorld(environment, size);
  const plate = world["shapes"].find((shape) => !shape.fixed);
  const radius = Math.min(0.12, environment.width / 20);
  const dragToCentre = environment.width / 2 - radius;
  world.apply({
    type: "throw",
    point: { x: radius, y: size.height / 2 },
    velocity: limitVelocity({ x: dragToCentre * 4, y: 0 }),
  });
  for (let i = 0; i < 120; i++)
    world.advance(TIME_STEP, { x: 0, y: -environment.gravity });
  return plate !== undefined && !world["shapes"].includes(plate);
};

it.each([
  MIN_FRACTURING_SCALE,
  0.1,
  DEFAULT_WORLD_SCALE,
  0.5,
  1,
  WORLD_SCALE_RANGE.max,
])(
  "replaces the default plate when a drag from the left wall to its centre throws a ball at it at world scale ×%s",
  (scale) => {
    expect(plateReplacedByThrow(scale)).toBe(true);
  },
);

it("leaves the default plate intact at the smallest world scale for the same drag", () => {
  expect(plateReplacedByThrow(WORLD_SCALE_RANGE.min)).toBe(false);
});
