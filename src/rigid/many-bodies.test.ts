/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { MAX_PARTICLES } from "@/sim/particles";
import { percentile } from "@/sim/timing";

import { centreExtent } from "./body";
import { fillBoxGrid } from "./body-pool";
import { GRAVITY, TIME_STEP } from "./constants";
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_WORLD_SCALE,
  type EnvironmentSettings,
  withWorldScale,
  WORLD_SCALE_RANGE,
  worldScale,
} from "./environment";
import { MAX_BODIES } from "./fracture";
import { live } from "./live";
import { initializePhysics, RigidWorld } from "./world";

// Bodies near Rapier's contact tolerance sink into the walls (#52), so the count shrinks below this scale.
const FULL_COUNT_SCALE = 0.05;
const NEVER_CRACKS = live(1e9);
const gravity = { x: 0, y: -GRAVITY };
const STEP_P95_LIMIT_MS = 8;
const SETTLE_CALLS = 200;
const SETTLE_STEP_SECONDS = 0.1;

beforeAll(initializePhysics);
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});

const build = (environment: EnvironmentSettings, count: number): RigidWorld => {
  const built = new RigidWorld(environment);
  world = built;
  fillBoxGrid(built, count, environment);
  return built;
};

const countAt = (environment: EnvironmentSettings): number =>
  Math.round(
    MAX_BODIES * Math.min(1, worldScale(environment) / FULL_COUNT_SCALE),
  );

const settle = (
  built: RigidWorld,
  pull: { x: number; y: number } = gravity,
): void => {
  for (let i = 0; i < SETTLE_CALLS; i++)
    built.advance(SETTLE_STEP_SECONDS, pull, NEVER_CRACKS);
};

const dynamicShapes = (built: RigidWorld) =>
  built["shapes"].filter(({ fixed }) => !fixed);

// Settled boxes rest on the floor, so only their centres can lie strictly inside.
const centresInside = (
  built: RigidWorld,
  { width, height }: EnvironmentSettings,
): boolean =>
  dynamicShapes(built).every(({ body }) => {
    const { x, y } = body.translation();
    return x > 0 && x < width && y > 0 && y < height;
  });

const outlinesInside = (
  built: RigidWorld,
  { width, height }: EnvironmentSettings,
): boolean =>
  dynamicShapes(built).every(({ body, polygon }) => {
    const { x, y } = body.translation();
    const extent = centreExtent(polygon, body.rotation());
    return (
      x - extent.left > 0 &&
      x + extent.right < width &&
      y - extent.bottom > 0 &&
      y + extent.top < height
    );
  });

describe.each([1, DEFAULT_WORLD_SCALE, WORLD_SCALE_RANGE.min])(
  "at world scale ×%s",
  (scale) => {
    it(`keeps every body of a full pile in the container through ${String(SETTLE_CALLS * SETTLE_STEP_SECONDS)} seconds`, () => {
      const environment = withWorldScale(DEFAULT_ENVIRONMENT, scale);
      const count = countAt(environment);
      const built = build(environment, count);
      expect(built.snapshot().stats.bodies).toBe(count);
      settle(built);
      const { stats } = built.snapshot();
      expect(stats.bodies).toBe(count);
      expect(stats.sleeping).toBe(count);
      expect(centresInside(built, environment)).toBe(true);
    }, 90_000);
  },
);

it("keeps every body of a full pile in the container at the minimum scale under sideways gravity", () => {
  const environment = withWorldScale(
    DEFAULT_ENVIRONMENT,
    WORLD_SCALE_RANGE.min,
  );
  const built = build(environment, countAt(environment));
  settle(built, { x: GRAVITY, y: -0.1 });
  expect(centresInside(built, environment)).toBe(true);
}, 90_000);

it("places a full pile inside a 4 × 3 world", () => {
  const environment = { ...DEFAULT_ENVIRONMENT, width: 4, height: 3 };
  const built = build(environment, MAX_BODIES);
  expect(outlinesInside(built, environment)).toBe(true);
});

it(`steps a settled ${String(MAX_BODIES)}-body pile with a p95 physics step under ${String(STEP_P95_LIMIT_MS)} ms`, () => {
  const built = build(DEFAULT_ENVIRONMENT, MAX_BODIES);
  settle(built);
  const samples = Array.from(
    { length: 600 },
    () => built.advance(TIME_STEP, gravity, NEVER_CRACKS).stats.stepMs,
  );
  const { stats } = built.snapshot();
  expect(stats.bodies).toBe(MAX_BODIES);
  expect(stats.sleeping).toBe(MAX_BODIES);
  const p95 = percentile(samples, 0.95);
  expect(p95).toBeLessThan(STEP_P95_LIMIT_MS);
}, 90_000);

it(`steps ${String(MAX_PARTICLES)} settled particles with a p95 physics step under ${String(STEP_P95_LIMIT_MS)} ms`, () => {
  const built = new RigidWorld(DEFAULT_ENVIRONMENT);
  world = built;
  const { width } = DEFAULT_ENVIRONMENT;
  for (let i = 0; i < MAX_PARTICLES; i++)
    built["particles"].spawn(
      { x: ((i + 0.5) / MAX_PARTICLES) * width, y: 1 + (i % 4) * 0.1 },
      { x: 0, y: 0 },
      0.01,
    );
  settle(built);
  const samples = Array.from(
    { length: 600 },
    () => built.advance(TIME_STEP, gravity, NEVER_CRACKS).stats.stepMs,
  );
  expect(built.snapshot().particles.length).toBe(MAX_PARTICLES * 3);
  expect(percentile(samples, 0.95)).toBeLessThan(STEP_P95_LIMIT_MS);
}, 90_000);
