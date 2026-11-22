/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GRAVITY, TIME_STEP, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { DEFAULT_ENVIRONMENT } from "./environment";
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
const gravity = { x: 0, y: -GRAVITY };

describe("rigid world", () => {
  it("keeps the real-glass default plate intact at floor level", () => {
    world = new RigidWorld("plate");
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
    world = new RigidWorld("plate");
    const initial = world.snapshot();
    expect(world.advance(0, gravity)).toEqual(initial);
    expect(world.advance(-1, gravity)).toEqual(initial);
    expect(world.advance(TIME_STEP / 2, gravity).stats.time).toBe(0);
    expect(world.advance(TIME_STEP / 2, gravity).stats.time).toBe(TIME_STEP);
    expect(world.advance(10, gravity).stats.time).toBeCloseTo(7 * TIME_STEP);
  });

  it("wakes sleeping bodies when gravity tilts", () => {
    world = new RigidWorld("plate");
    for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity, 10000);
    expect(world.snapshot().stats.sleeping).toBe(world.snapshot().stats.bodies);
    const moved = world.advance(0.1, { x: GRAVITY, y: 0 }, 10000);
    expect(moved.stats.sleeping).toBe(0);
    expect(moved.poses[16]).toBeGreaterThan(5);
  });

  it.each(["pile", "stress"] as const)(
    "keeps every %s body in the container through 20 seconds",
    (scene) => {
      world = new RigidWorld(scene);
      for (let i = 0; i < 200; i++) world.advance(0.1, gravity);
      const { poses, stats } = world.snapshot();
      expect(stats.bodies).toBeGreaterThanOrEqual(
        scene === "pile" ? 1000 : 2000,
      );
      expect(stats.bodies).toBeLessThanOrEqual(2000);
      expect(stats.mass).toBeCloseTo(
        (scene === "pile" ? 1000 : 2000) * 0.36,
        10,
      );
      expect(stats.sleeping).toBe(stats.bodies);
      for (let i = 16; i < poses.length; i += 4) {
        expect(poses[i]).toBeGreaterThan(0);
        expect(poses[i]).toBeLessThan(WORLD_WIDTH);
        expect(poses[i + 1]).toBeGreaterThan(0);
        expect(poses[i + 1]).toBeLessThan(WORLD_HEIGHT);
      }
    },
  );
});

it("refuses invalid convex geometry", () => {
  vi.spyOn(RAPIER.ColliderDesc, "convexHull").mockReturnValueOnce(null);
  expect(() => new RigidWorld("plate")).toThrow("Invalid convex body");
});

it("reports a non-finite engine state", () => {
  world = new RigidWorld("plate");
  vi.spyOn(RAPIER.RigidBody.prototype, "rotation").mockReturnValueOnce(NaN);
  expect(() => world?.snapshot()).toThrow("Non-finite rigid-body state");
});

it("routes pointer actions and appends a ball with matching geometry and poses", () => {
  world = new RigidWorld("plate");
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
  world = new RigidWorld("plate");
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
  world = new RigidWorld("plate");
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 0.501 }, true);
  for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity, 10000);
  world.apply({ type: "grab", point: { x: 5, y: 0.5 } });
  world.apply({ type: "move", point: { x: 5, y: -3 } });
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity, 10000);
  expect(world.snapshot().poses[17]).toBeGreaterThan(0.45);
});

it("can grab a thrown ball and keep it in the container", () => {
  world = new RigidWorld("plate");
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
  world = new RigidWorld("plate", {
    ...DEFAULT_ENVIRONMENT,
    width: 18,
    height: 8,
    density: 50,
    gravity: 0,
    friction: 0.8,
  });
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
  world = new RigidWorld("plate");
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 2.5 }, true);
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity, 0.07, 0.83);
  expect(world.snapshot().stats.bodies).toBeGreaterThan(1);
  for (const shape of world["shapes"])
    expect(shape.body.collider(0).friction()).toBeCloseTo(0.83);
});

it("uses selected grab limits beyond the old right wall and ceiling", () => {
  world = new RigidWorld("plate", {
    ...DEFAULT_ENVIRONMENT,
    width: 18,
    height: 8,
  });
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

it.each([NaN, Infinity, -0.1, 2.1])(
  "rejects invalid live friction %s",
  (friction) => {
    world = new RigidWorld("plate");
    expect(() => world?.advance(0, gravity, 10000, friction)).toThrow(
      "Invalid environment setting: friction",
    );
  },
);

it("live friction slows a sliding plate while zero friction preserves its speed", () => {
  const distances: number[] = [];
  for (const friction of [0, 1]) {
    world = new RigidWorld("plate");
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
    world = new RigidWorld("plate");
    world.setVisibleHeight(12);
    world.apply({ type: "grab", point: { x: 5, y: 0.5 } });
    world.apply({ type: "move", point: { x: 5, y: 11 } });
    for (let i = 0; i < 240; i++)
      world.advance(TIME_STEP, { x: 0, y: 0 }, 10000);
    expect(world.snapshot().poses[17]).toBeCloseTo(11, 1);
  });

  it("clamps throws to the visible height", () => {
    world = new RigidWorld("plate");
    world.setVisibleHeight(12);
    world.apply({
      type: "throw",
      point: { x: 5, y: 99 },
      velocity: { x: 0, y: 0 },
    });
    expect(world["shapes"].at(-1)?.body.translation().y).toBeCloseTo(11.88);
  });

  it("keeps the configured height when the view is shorter", () => {
    world = new RigidWorld("plate");
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
    world = new RigidWorld("plate");
    world.setVisibleHeight(20);
    world["shapes"][4]?.body.setTranslation({ x: 9.7, y: 15 }, true);
    world["shapes"][4]?.body.setLinvel({ x: 30, y: 0 }, true);
    for (let i = 0; i < 120; i++)
      world.advance(TIME_STEP, { x: 0, y: 0 }, 10000);
    expect(world.snapshot().poses[16]).toBeLessThan(WORLD_WIDTH);
  });

  it("rejects an invalid height and ignores an unchanged one", () => {
    world = new RigidWorld("plate");
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
