/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  GRAVITY,
  TIME_STEP,
  WAKE_GRAVITY_DELTA,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_WORLD_SCALE,
  withWorldScale,
  WORLD_SCALE_RANGE,
} from "./environment";
import { OBJECT_SHAPES } from "./object-shape";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(async () => {
  await initializePhysics();
  await initializePhysics();
});
let world: RigidWorld | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  world?.dispose();
  world = undefined;
});
const PLATE = { width: 2, height: 1 };
const gravity = { x: 0, y: -GRAVITY };

describe("rigid world", () => {
  it("keeps the real-glass default plate intact at floor level", () => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    const vertices = world.vertices();
    expect(vertices).toHaveLength(5 * 6 * 6);
    expect(world.snapshot().poses[17]).toBeCloseTo(0.5, 2);
    for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity);
    const { poses, stats } = world.snapshot();
    expect(poses.every(Number.isFinite)).toBe(true);
    expect(stats.bodies).toBe(1);
    expect(stats.sleeping).toBe(stats.bodies);
    expect(stats.mass).toBeCloseTo(50, 12);
    expect(world.vertices()).toEqual(vertices);
  });

  it("advances at a fixed 60 Hz, clamps stalls and leaves paused frames unchanged", () => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    const initial = world.snapshot();
    expect(world.advance(0, gravity)).toEqual(initial);
    expect(world.advance(-1, gravity)).toEqual(initial);
    expect(world.advance(TIME_STEP / 2, gravity).stats.time).toBe(0);
    expect(world.advance(TIME_STEP / 2, gravity).stats.time).toBe(TIME_STEP);
    expect(world.advance(10, gravity).stats.time).toBeCloseTo(7 * TIME_STEP);
  });

  it("wakes sleeping bodies when gravity tilts", () => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity, 10000);
    expect(world.snapshot().stats.sleeping).toBe(world.snapshot().stats.bodies);
    const moved = world.advance(0.1, { x: GRAVITY, y: 0 }, 10000);
    expect(moved.stats.sleeping).toBe(0);
    expect(moved.poses[16]).toBeGreaterThan(5);
  });

  describe("gravity jitter", () => {
    const settle = (): RigidWorld => {
      const settled = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
      for (let i = 0; i < 600; i++) settled.advance(TIME_STEP, gravity, 10000);
      return settled;
    };

    it("keeps bodies asleep under jitter below the wake delta while applying the exact gravity", () => {
      world = settle();
      const jitter = WAKE_GRAVITY_DELTA / 3;
      for (let i = 0; i < 120; i++)
        world.advance(
          TIME_STEP,
          { x: i % 2 ? jitter : -jitter, y: -GRAVITY },
          10000,
        );
      expect(world.snapshot().stats.sleeping).toBe(1);
      expect(world["world"].gravity.x).toBeCloseTo(jitter, 12);
    });

    it("settles again under tilted-device jitter that exceeds half the wake delta", () => {
      world = settle();
      const amplitude = WAKE_GRAVITY_DELTA * 0.6;
      for (let i = 0; i < 900; i++)
        world.advance(
          TIME_STEP,
          { x: 0.3 + (i % 2 ? amplitude : -amplitude), y: -GRAVITY },
          10000,
        );
      expect(world.snapshot().stats.sleeping).toBe(1);
    });

    it("wakes on a slow drift once it passes the wake delta from the last wake", () => {
      world = settle();
      for (let i = 1; i <= 5; i++)
        for (let frame = 0; frame < 10; frame++)
          world.advance(
            TIME_STEP,
            { x: i * WAKE_GRAVITY_DELTA * 0.4, y: -GRAVITY },
            10000,
          );
      expect(world.snapshot().stats.sleeping).toBe(0);
    });

    it("wakes within a fraction of a second on a single step of the Gravity setting", () => {
      world = settle();
      for (let frame = 0; frame < 10; frame++)
        world.advance(TIME_STEP, { x: 0, y: -(GRAVITY + 0.1) }, 10000);
      expect(world.snapshot().stats.sleeping).toBe(0);
    });
  });

  describe.each([1, DEFAULT_WORLD_SCALE, WORLD_SCALE_RANGE.min])(
    "at world scale ×%s",
    (scale) => {
      it.each(["pile", "stress"] as const)(
        "keeps every %s body in the container through 20 seconds",
        (scene) => {
          const environment = withWorldScale(DEFAULT_ENVIRONMENT, scale);
          world = new RigidWorld(scene, environment);
          const full = scene === "pile" ? 1000 : 2000;
          expect(world.snapshot().stats.bodies).toBe(
            Math.round(full * Math.min(1, scale / 0.05)),
          );
          for (let i = 0; i < 200; i++) world.advance(0.1, gravity);
          const { poses, stats } = world.snapshot();
          expect(stats.bodies).toBeLessThanOrEqual(2000);
          expect(stats.sleeping).toBe(stats.bodies);
          for (let i = 16; i < poses.length; i += 4) {
            expect(poses[i]).toBeGreaterThan(0);
            expect(poses[i]).toBeLessThan(environment.width);
            expect(poses[i + 1]).toBeGreaterThan(0);
            expect(poses[i + 1]).toBeLessThan(environment.height);
          }
        },
      );
    },
  );
});

it.each(["pile", "stress"] as const)(
  "keeps every %s body in the container at the minimum scale under sideways gravity",
  (scene) => {
    const environment = withWorldScale(
      DEFAULT_ENVIRONMENT,
      WORLD_SCALE_RANGE.min,
    );
    world = new RigidWorld(scene, environment);
    for (let i = 0; i < 200; i++) world.advance(0.1, { x: GRAVITY, y: -0.1 });
    const { poses } = world.snapshot();
    for (let i = 16; i < poses.length; i += 4) {
      expect(poses[i]).toBeGreaterThan(0);
      expect(poses[i]).toBeLessThan(environment.width);
    }
  },
);

it.each([
  ["floor", { x: 5, y: -0.3 }],
  ["left wall", { x: -0.3, y: 1 }],
  ["right wall", { x: WORLD_WIDTH + 0.3, y: 1 }],
  ["ceiling", { x: 5, y: WORLD_HEIGHT + 0.3 }],
])("lifts a body that sank into the %s back inside", (_side, position) => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  const body = world["shapes"][4]?.body;
  if (body === undefined) throw new Error("Missing plate");
  body.setTranslation(position, true);
  body.setLinvel({ x: 3, y: -3 }, true);
  world.advance(TIME_STEP, { x: 0, y: 0 }, 10000);
  const { x, y } = body.translation();
  expect(x).toBeGreaterThan(0);
  expect(x).toBeLessThan(WORLD_WIDTH);
  expect(y).toBeGreaterThan(0);
  expect(y).toBeLessThan(WORLD_HEIGHT);
  expect(body.linvel()).toEqual({ x: 0, y: 0 });
});

it.each(OBJECT_SHAPES)(
  "puts a sunk %s back at the height it is first placed on the floor",
  (shape) => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE, shape);
    const body = world["shapes"][4]?.body;
    if (body === undefined) throw new Error("Missing plate");
    const placed = body.translation().y;
    body.setTranslation({ x: 5, y: -0.3 }, true);
    world.advance(TIME_STEP, { x: 0, y: 0 }, 10000);
    expect(body.translation().y).toBeCloseTo(placed, 3);
  },
);

it("refuses invalid convex geometry", () => {
  vi.spyOn(RAPIER.ColliderDesc, "convexHull").mockReturnValueOnce(null);
  expect(() => new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE)).toThrow(
    "Invalid convex body",
  );
});

it("reports a non-finite engine state", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  vi.spyOn(RAPIER.RigidBody.prototype, "rotation").mockReturnValueOnce(NaN);
  expect(() => world?.snapshot()).toThrow("Non-finite rigid-body state");
});

it("routes pointer actions and appends a ball with matching geometry and poses", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  expect(world.apply({ type: "grab", point: { x: 5, y: 0.5 } })).toBe(false);
  world.apply({ type: "move", point: { x: 5, y: 3.5 } });
  for (let i = 0; i < 60; i++) world.advance(TIME_STEP, gravity);
  expect(world.snapshot().poses[17]).toBeGreaterThan(3.3);
  world.apply({ type: "release", velocity: { x: 2, y: 0 } });
  world.apply({ type: "blast", point: { x: 4, y: 3.5 } });
  expect(
    world.apply({
      type: "throw",
      point: { x: 1, y: 1 },
      velocity: { x: 50, y: 0 },
    }),
  ).toBe(true);
  const initial = world.snapshot();
  expect(initial.stats.bodies).toBe(2);
  expect(world.vertices()).toHaveLength(5 * 6 * 6 + 18 * 6);
  const moved = world.advance(TIME_STEP, gravity);
  expect(moved.poses[20]).toBeGreaterThan(initial.poses[20] ?? Infinity);
});

it("keeps thrown balls inside even when the launch starts in the floor margin", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  world.apply({
    type: "throw",
    point: { x: 5, y: -0.35 },
    velocity: { x: 0, y: 0 },
  });
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity);
  const poses = world.snapshot().poses;
  expect(poses[poses.length - 3]).toBeGreaterThan(0.1);
});

it("keeps a grabbed plate above the floor when capture drags below the canvas", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 0.501 }, true);
  for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity, 10000);
  world.apply({ type: "grab", point: { x: 5, y: 0.5 } });
  world.apply({ type: "move", point: { x: 5, y: -3 } });
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity, 10000);
  expect(world.snapshot().poses[17]).toBeGreaterThan(0.45);
});

it("can grab a thrown ball and keep it in the container", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  world.apply({
    type: "throw",
    point: { x: 1, y: 1 },
    velocity: { x: 0, y: 0 },
  });
  world.apply({ type: "grab", point: { x: 1, y: 1 } });
  world.apply({ type: "move", point: { x: -5, y: 2 } });
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity);
  const poses = world.snapshot().poses;
  expect(poses[poses.length - 4]).toBeGreaterThan(0.1);
  expect(poses[poses.length - 3]).toBeCloseTo(2, 1);
});

it("builds selected walls, plate mass and throws within the new bounds", () => {
  world = new RigidWorld(
    "plate",
    {
      ...DEFAULT_ENVIRONMENT,
      width: 18,
      height: 8,
      density: 50,
      gravity: 0,
      friction: 0.8,
    },
    PLATE,
  );
  expect(world.snapshot().poses[16]).toBe(9);
  expect(world.snapshot().poses[17]).toBeCloseTo(0.5, 2);
  expect(world.snapshot().stats.mass).toBe(100);
  world.apply({
    type: "throw",
    point: { x: 99, y: 99 },
    velocity: { x: 0, y: 0 },
  });
  const ball = world["shapes"].at(-1);
  expect(ball?.body.translation().x).toBeCloseTo(17.88);
  expect(ball?.body.translation().y).toBeCloseTo(7.88);
  expect(ball?.body.collider(0).friction()).toBeCloseTo(0.8);
  world.advance(0, { x: 0, y: 0 }, 10000, 0);
  for (const shape of world["shapes"])
    expect(shape.body.collider(0).friction()).toBe(0);
});

it("keeps friction on recursively created fragments", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 2.5 }, true);
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity, 0.07, 0.83);
  expect(world.snapshot().stats.bodies).toBeGreaterThan(1);
  for (const shape of world["shapes"])
    expect(shape.body.collider(0).friction()).toBeCloseTo(0.83);
});

it("uses selected grab limits beyond the old right wall and ceiling", () => {
  world = new RigidWorld(
    "plate",
    {
      ...DEFAULT_ENVIRONMENT,
      width: 18,
      height: 8,
    },
    PLATE,
  );
  world.apply({ type: "grab", point: { x: 9, y: 0.5 } });
  world.apply({ type: "move", point: { x: 16, y: 7 } });
  for (let i = 0; i < 240; i++) world.advance(TIME_STEP, { x: 0, y: 0 }, 10000);
  expect(world.snapshot().poses[16]).toBeCloseTo(16, 1);
  expect(world.snapshot().poses[17]).toBeCloseTo(7, 1);
});

it.each(["pile", "stress"] as const)(
  "fits %s inside the smallest supported world",
  (scene) => {
    world = new RigidWorld(scene, {
      ...DEFAULT_ENVIRONMENT,
      width: 4,
      height: 3,
    });
    const shapes = world["shapes"].slice(4);
    for (const { body, polygon } of shapes) {
      const center = body.translation();
      for (const [x, y] of polygon) {
        expect(center.x + x).toBeGreaterThan(0);
        expect(center.x + x).toBeLessThan(4);
        expect(center.y + y).toBeGreaterThan(0);
        expect(center.y + y).toBeLessThan(3);
      }
    }
  },
);

it.each(["plate", "pile", "stress"] as const)(
  "builds %s at the minimum world scale with the default object size",
  (scene) => {
    const environment = withWorldScale(
      DEFAULT_ENVIRONMENT,
      WORLD_SCALE_RANGE.min,
    );
    world = new RigidWorld(scene, environment);
    for (let i = 0; i < 5; i++) world.advance(0.1, gravity);
    expect(world.snapshot().poses.every(Number.isFinite)).toBe(true);
  },
);

it.each([NaN, Infinity, -0.1, 2.1])(
  "rejects invalid live friction %s",
  (friction) => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    expect(() => world?.advance(0, gravity, 10000, friction)).toThrow(
      "Invalid environment setting: friction",
    );
  },
);

it("live friction slows a sliding plate while zero friction preserves its speed", () => {
  const distances: number[] = [];
  for (const friction of [0, 1]) {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity, 10000);
    const body = world["shapes"][4]?.body;
    if (body === undefined) throw new Error("Missing plate");
    const start = body.translation().x;
    body.setLinvel({ x: 5, y: 0 }, true);
    for (let i = 0; i < 30; i++)
      world.advance(TIME_STEP, gravity, 10000, friction);
    distances.push(body.translation().x - start);
    world.dispose();
    world = undefined;
  }
  expect(distances[0]).toBeGreaterThan(2.4);
  expect(distances[1]).toBeLessThan(1.5);
});

describe("visible height", () => {
  it("lets a body rise to a ceiling raised to the visible height", () => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    world.setVisibleHeight(12);
    world.apply({ type: "grab", point: { x: 5, y: 0.5 } });
    world.apply({ type: "move", point: { x: 5, y: 11 } });
    for (let i = 0; i < 240; i++)
      world.advance(TIME_STEP, { x: 0, y: 0 }, 10000);
    expect(world.snapshot().poses[17]).toBeCloseTo(11, 1);
  });

  it("clamps throws to the visible height", () => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    world.setVisibleHeight(12);
    world.apply({
      type: "throw",
      point: { x: 5, y: 99 },
      velocity: { x: 0, y: 0 },
    });
    expect(world["shapes"].at(-1)?.body.translation().y).toBeCloseTo(11.88);
  });

  it("keeps the configured height when the view is shorter", () => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    world.setVisibleHeight(2);
    world.apply({
      type: "throw",
      point: { x: 5, y: 99 },
      velocity: { x: 0, y: 0 },
    });
    expect(world["shapes"].at(-1)?.body.translation().y).toBeCloseTo(
      WORLD_HEIGHT - 0.12,
    );
  });

  it("keeps the walls tall enough after the ceiling moves", () => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    world.setVisibleHeight(20);
    world["shapes"][4]?.body.setTranslation({ x: 9.7, y: 15 }, true);
    world["shapes"][4]?.body.setLinvel({ x: 30, y: 0 }, true);
    for (let i = 0; i < 120; i++)
      world.advance(TIME_STEP, { x: 0, y: 0 }, 10000);
    expect(world.snapshot().poses[16]).toBeLessThan(WORLD_WIDTH);
  });

  it("rejects an invalid height and ignores an unchanged one", () => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
    expect(() => {
      world?.setVisibleHeight(Number.NaN);
    }).toThrow("Invalid visible height");
    expect(() => {
      world?.setVisibleHeight(-1);
    }).toThrow("Invalid visible height");
    world.setVisibleHeight(WORLD_HEIGHT);
    expect(world["environment"].height).toBe(WORLD_HEIGHT);
  });
});
