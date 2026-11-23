/* eslint-disable @typescript-eslint/dot-notation -- Compare real Rapier mass properties and force actual drops. */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { TIME_STEP } from "./constants";
import { DEFAULT_ENVIRONMENT } from "./environment";
import { live } from "./live";
import { OBJECT_SHAPES } from "./object-shape";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});
const properties = {
  rectangle: { area: 2, inertiaPerMass: 5 / 12 },
  triangle: { area: 1, inertiaPerMass: 4 / 24 + 1 / 18 },
  hexagon: { area: 1.5, inertiaPerMass: (5 * 4) / 96 + 5 / 72 },
  ellipse: {
    area: 8 * Math.sin(Math.PI / 16),
    inertiaPerMass: (5 * (2 + Math.cos(Math.PI / 16))) / 48,
  },
};
it.each(OBJECT_SHAPES)(
  "starts %s grounded and intact with shape-specific mass and inertia",
  (shape) => {
    world = new RigidWorld(
      "plate",
      DEFAULT_ENVIRONMENT,
      { width: 2, height: 1 },
      shape,
    );
    const initial = world.snapshot();
    const body = world["shapes"][4];
    if (body === undefined) throw new Error("Missing shape");
    expect(
      Math.min(...body.polygon.map(([, y]) => y)) + (initial.poses[17] ?? NaN),
    ).toBeCloseTo(0, 2);
    const mass = properties[shape].area * 25;
    expect(initial.stats.mass).toBeCloseTo(mass, 10);
    expect(body.body.mass()).toBeCloseTo(mass, 4);
    expect(body.body.principalInertia()).toBeCloseTo(
      mass * properties[shape].inertiaPerMass,
      4,
    );
    for (let i = 0; i < 120; i++) world.advance(1 / 60, { x: 0, y: -9.8 });
    expect(world.snapshot().stats.bodies).toBe(1);
    expect(world.snapshot().stats.sleeping).toBe(1);
    expect(world.snapshot().stats.mass).toBe(initial.stats.mass);
  },
);
it.each(OBJECT_SHAPES)(
  "fractures a dropped %s without changing mass",
  (shape) => {
    world = new RigidWorld(
      "plate",
      DEFAULT_ENVIRONMENT,
      { width: 2, height: 1 },
      shape,
    );
    const body = world["shapes"][4]?.body;
    if (body === undefined) throw new Error("Missing shape");
    const initial = world.snapshot().stats.mass;
    const position = body.translation();
    body.setTranslation({ x: position.x, y: position.y + 0.15 }, true);
    for (let i = 0; i < 120; i++) world.advance(1 / 60, { x: 0, y: -9.8 });
    expect(world.snapshot().stats.bodies).toBeGreaterThan(1);
    expect(world.snapshot().stats.mass).toBeCloseTo(initial, 10);
    expect(world.snapshot().poses.every(Number.isFinite)).toBe(true);
  },
);
const sunkPositions = [
  ["floor", () => ({ x: 5, y: -0.3 })],
  ["ceiling", () => ({ x: 5, y: DEFAULT_ENVIRONMENT.height + 0.3 })],
  ["left wall", () => ({ x: -0.3, y: 3 })],
  ["right wall", () => ({ x: DEFAULT_ENVIRONMENT.width + 0.3, y: 3 })],
] as const;
describe.each(OBJECT_SHAPES)("a sunk %s", (shape) => {
  it.each(sunkPositions)(
    "is returned with its rotated outline touching the %s",
    (side, position) => {
      for (const angle of [0, Math.PI / 2, Math.PI, 0.7]) {
        world?.dispose();
        world = new RigidWorld(
          "plate",
          DEFAULT_ENVIRONMENT,
          { width: 2, height: 1 },
          shape,
        );
        const body = world["shapes"][4];
        if (body === undefined) throw new Error("Missing shape");
        body.body.setRotation(angle, true);
        body.body.setTranslation(position(), true);
        world.advance(TIME_STEP, { x: 0, y: 0 }, live(10000));
        const { x, y } = body.body.translation();
        const points = body.polygon.map(([px, py]) => ({
          x: x + px * Math.cos(angle) - py * Math.sin(angle),
          y: y + px * Math.sin(angle) + py * Math.cos(angle),
        }));
        const edge = {
          floor: Math.min(...points.map((point) => point.y)),
          ceiling: Math.max(...points.map((point) => point.y)),
          "left wall": Math.min(...points.map((point) => point.x)),
          "right wall": Math.max(...points.map((point) => point.x)),
        }[side];
        const wall = {
          floor: 0,
          ceiling: DEFAULT_ENVIRONMENT.height,
          "left wall": 0,
          "right wall": DEFAULT_ENVIRONMENT.width,
        }[side];
        expect(edge).toBeCloseTo(wall, 1);
      }
    },
  );
});
it("returns a sunk ball by its radius whatever its rotation", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, {
    width: 2,
    height: 1,
  });
  world.apply({
    type: "throw",
    point: { x: 5, y: 3 },
    velocity: { x: 0, y: 0 },
  });
  const ball = world["shapes"][5];
  if (ball?.ball !== true) throw new Error("Missing ball");
  ball.body.setRotation(Math.PI / 8, true);
  ball.body.setTranslation({ x: 5, y: -0.3 }, true);
  world.advance(TIME_STEP, { x: 0, y: 0 }, live(10000));
  expect(ball.body.translation().y).toBeCloseTo(0.12, 3);
});
