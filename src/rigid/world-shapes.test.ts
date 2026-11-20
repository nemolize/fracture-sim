/* eslint-disable @typescript-eslint/dot-notation -- Compare real Rapier mass properties and force actual drops. */
import { afterEach, beforeAll, expect, it } from "vitest";

import { DEFAULT_ENVIRONMENT } from "./environment";
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
