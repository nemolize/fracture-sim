/* eslint-disable @typescript-eslint/dot-notation -- Reach the private grid state through the real world. */
import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, expect, it } from "vitest";

import { type BodyShape, polygonCollider } from "./body";
import { TIME_STEP } from "./constants";
import { BodyObstacles, bodyObstacles } from "./obstacles";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
const worlds: RigidWorld[] = [];
afterEach(() => {
  worlds.splice(0).forEach((w) => {
    w.dispose();
  });
});

it("places a rotated body's outline in world space and skips fixed bodies", () => {
  const engine = new RAPIER.World({ x: 0, y: 0 });
  const polygon = [
    [-1, -0.5],
    [1, -0.5],
    [1, 0.5],
    [-1, 0.5],
  ] as const;
  const make = (fixed: boolean): BodyShape => {
    const body = engine.createRigidBody(
      (fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic())
        .setTranslation(3, 2)
        .setRotation(Math.PI / 2),
    );
    engine.createCollider(polygonCollider(polygon), body);
    return {
      body,
      polygon,
      domain: polygon.map(([x, y]) => ({ x, y })),
      mass: 1,
      fixed,
      ball: false,
    };
  };
  const [only] = bodyObstacles([make(true), make(false)]);
  try {
    expect(bodyObstacles([make(true)])).toEqual([]);
    expect(only?.centre).toEqual({ x: 3, y: 2 });
    expect(only?.extent).toBeCloseTo(Math.hypot(1, 0.5), 6);
    expect(only?.ring[2]?.x).toBeCloseTo(3 - 0.5, 6);
    expect(only?.ring[2]?.y).toBeCloseTo(2 + 1, 6);
  } finally {
    engine.free();
  }
});

it("lets particles rest on a settled body", () => {
  const world = new RigidWorld();
  worlds.push(world);
  const gravity = { x: 0, y: -9.8 };
  for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity);
  const plate = world["shapes"].find(({ fixed }) => !fixed);
  if (plate === undefined) throw new Error("Missing plate");
  expect(plate.body.isSleeping()).toBe(true);
  const [outline] = bodyObstacles([plate]);
  const top = Math.max(...(outline?.ring.map((v) => v.y) ?? [0]));
  world["particles"].spawn(
    { x: plate.body.translation().x, y: top + 0.2 },
    { x: 0, y: 0 },
    0.01,
  );
  for (let i = 0; i < 60; i++) world.advance(TIME_STEP, gravity);
  expect(world.snapshot().particles[1]).toBeGreaterThanOrEqual(top - 1e-3);
  expect(world.snapshot().stats.particles).toBe(1);
});

const settledBody = (engine: RAPIER.World) => {
  const polygon = [
    [-1, -0.5],
    [1, -0.5],
    [1, 0.5],
    [-1, 0.5],
  ] as const;
  const body = engine.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(5, 2).setCcdEnabled(true),
  );
  engine.createCollider(polygonCollider(polygon), body);
  const shape: BodyShape = {
    body,
    polygon,
    domain: polygon.map(([x, y]) => ({ x, y })),
    mass: 1,
    fixed: false,
    ball: false,
  };
  return shape;
};

it("reuses the grid while every body sleeps and rebuilds when geometry changes or something wakes", () => {
  const engine = new RAPIER.World({ x: 0, y: 0 });
  try {
    const shape = settledBody(engine);
    const obstacles = new BodyObstacles(10, 5);
    const at = (y: number) => obstacles.grid.sweep(5, y + 0.2, 5, y, 0.05);
    shape.body.sleep();
    obstacles.refresh([shape], 0, true);
    expect(at(2)).not.toBeNull();
    // Moved without waking: a stale grid is kept for the same geometry...
    shape.body.setTranslation({ x: 5, y: 4 }, false);
    obstacles.refresh([shape], 0, true);
    expect(at(2)).not.toBeNull();
    expect(at(4)).toBeNull();
    // ...but a new geometry revision rebuilds it.
    obstacles.refresh([shape], 1, true);
    expect(at(4)).not.toBeNull();
    shape.body.wakeUp();
    shape.body.setTranslation({ x: 5, y: 2 }, true);
    obstacles.refresh([shape], 1, true);
    expect(at(2)).not.toBeNull();
    shape.body.setTranslation({ x: 5, y: 4 }, true);
    obstacles.refresh([shape], 1, false);
    expect(at(4)).toBeNull();
    obstacles.refresh([shape], 1, true);
    expect(at(4)).not.toBeNull();
  } finally {
    engine.free();
  }
});
