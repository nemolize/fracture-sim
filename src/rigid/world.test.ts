import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GRAVITY, TIME_STEP, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
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
  it("drops a plate from 2 m above the floor and preserves its shape", () => {
    world = new RigidWorld("plate");
    const vertices = world.vertices();
    expect(vertices).toHaveLength(5 * 6 * 6);
    expect(world.snapshot().poses[17]).toBe(2.5);
    for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity);
    const { poses, stats } = world.snapshot();
    expect(poses[17]).toBeCloseTo(0.5, 2);
    expect(stats).toMatchObject({ bodies: 1, sleeping: 1 });
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
    for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity);
    expect(world.snapshot().stats.sleeping).toBe(1);
    const moved = world.advance(0.1, { x: GRAVITY, y: 0 });
    expect(moved.stats.sleeping).toBe(0);
    expect(moved.poses[16]).toBeGreaterThan(5);
  });

  it.each(["pile", "stress"] as const)(
    "keeps every %s body in the container through 20 seconds",
    (scene) => {
      world = new RigidWorld(scene);
      for (let i = 0; i < 200; i++) world.advance(0.1, gravity);
      const { poses, stats } = world.snapshot();
      expect(stats.bodies).toBe(scene === "pile" ? 1000 : 2000);
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
  expect(world.apply({ type: "grab", point: { x: 5, y: 2.5 } })).toBe(false);
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
  expect(world.snapshot().poses[21]).toBeGreaterThan(0.1);
});

it("keeps a grabbed plate above the floor when capture drags below the canvas", () => {
  world = new RigidWorld("plate");
  for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity);
  world.apply({ type: "grab", point: { x: 5, y: 0.5 } });
  world.apply({ type: "move", point: { x: 5, y: -3 } });
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity);
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
  expect(world.snapshot().poses[20]).toBeGreaterThan(0.1);
  expect(world.snapshot().poses[21]).toBeCloseTo(2, 1);
});
