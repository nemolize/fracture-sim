import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { percentile } from "@/sim/timing";

import { GRAVITY, TIME_STEP } from "./constants";
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_WORLD_SCALE,
  type EnvironmentSettings,
  withWorldScale,
  WORLD_SCALE_RANGE,
} from "./environment";
import { MAX_BODIES } from "./fracture";
import { live } from "./live";
import { addBoxGrid } from "./many-bodies";
import { initializePhysics, RigidWorld } from "./world";

// Bodies near Rapier's contact tolerance sink into the walls (#52), so the count shrinks below this scale.
const FULL_COUNT_SCALE = 0.05;
const NEVER_CRACKS = live(1e9);
const gravity = { x: 0, y: -GRAVITY };
// The removed browser-worker benchmark's limit, measured on a settled 2000-body pile.
const STEP_P95_LIMIT_MS = 8;

beforeAll(initializePhysics);
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});

const build = (environment: EnvironmentSettings, count: number): RigidWorld => {
  const built = new RigidWorld(environment);
  world = built;
  addBoxGrid(built, count - 1, environment);
  return built;
};

const countAt = (environment: EnvironmentSettings): number =>
  Math.round(
    MAX_BODIES *
      Math.min(
        1,
        environment.width / DEFAULT_ENVIRONMENT.width / FULL_COUNT_SCALE,
      ),
  );

const allContained = (
  built: RigidWorld,
  { width, height }: EnvironmentSettings,
): boolean => {
  const { poses } = built.snapshot();
  for (let i = 16; i < poses.length; i += 4) {
    const x = poses[i] ?? NaN;
    const y = poses[i + 1] ?? NaN;
    if (!(x > 0 && x < width && y > 0 && y < height)) return false;
  }
  return true;
};

describe.each([1, DEFAULT_WORLD_SCALE, WORLD_SCALE_RANGE.min])(
  "at world scale ×%s",
  (scale) => {
    it("keeps every body of a full pile in the container through 20 seconds", () => {
      const environment = withWorldScale(DEFAULT_ENVIRONMENT, scale);
      const count = countAt(environment);
      const built = build(environment, count);
      expect(built.snapshot().stats.bodies).toBe(count);
      for (let i = 0; i < 200; i++) built.advance(0.1, gravity, NEVER_CRACKS);
      const { stats } = built.snapshot();
      expect(stats.bodies).toBe(count);
      expect(stats.sleeping).toBe(count);
      expect(allContained(built, environment)).toBe(true);
    }, 90_000);
  },
);

it("keeps every body of a full pile in the container at the minimum scale under sideways gravity", () => {
  const environment = withWorldScale(
    DEFAULT_ENVIRONMENT,
    WORLD_SCALE_RANGE.min,
  );
  const built = build(environment, countAt(environment));
  for (let i = 0; i < 200; i++)
    built.advance(0.1, { x: GRAVITY, y: -0.1 }, NEVER_CRACKS);
  expect(allContained(built, environment)).toBe(true);
}, 90_000);

it("places a full pile inside the smallest supported world", () => {
  const environment = { ...DEFAULT_ENVIRONMENT, width: 4, height: 3 };
  const built = build(environment, MAX_BODIES);
  expect(allContained(built, environment)).toBe(true);
});

it("steps a settled 2000-body pile with a p95 physics step under 8 ms", () => {
  const built = build(DEFAULT_ENVIRONMENT, MAX_BODIES);
  for (let i = 0; i < 200; i++) built.advance(0.1, gravity, NEVER_CRACKS);
  const samples = Array.from(
    { length: 600 },
    () => built.advance(TIME_STEP, gravity, NEVER_CRACKS).stats.stepMs,
  );
  const { stats } = built.snapshot();
  expect(stats.bodies).toBe(MAX_BODIES);
  expect(stats.sleeping).toBe(MAX_BODIES);
  expect(percentile(samples, 0.95)).toBeLessThan(STEP_P95_LIMIT_MS);
}, 90_000);
