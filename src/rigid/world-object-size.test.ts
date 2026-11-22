import { afterEach, beforeAll, expect, it } from "vitest";

import { DEFAULT_ENVIRONMENT } from "./environment";
import { live } from "./live";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});

it.each([
  { width: 0.1, height: 0.1 },
  { width: 0.1, height: 5.1 },
  { width: 9.9, height: 0.1 },
  { width: 9.9, height: 5.1 },
  { width: 4, height: 2.4 },
])("builds an intact grounded box with size $width × $height", (size) => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, size);
  const vertices = world.vertices();
  const x: number[] = [],
    y: number[] = [];
  for (let i = 0; i < vertices.length; i += 6) {
    if (vertices[i + 2] === 4) {
      x.push(vertices[i] ?? NaN);
      y.push(vertices[i + 1] ?? NaN);
    }
  }
  expect(Math.max(...x) - Math.min(...x)).toBeCloseTo(size.width, 6);
  expect(Math.max(...y) - Math.min(...y)).toBeCloseTo(size.height, 6);
  expect(world.snapshot().poses[17]).toBeCloseTo(size.height / 2, 2);
  for (let i = 0; i < 120; i++) world.advance(1 / 60, { x: 0, y: -9.8 });
  expect(world.snapshot().stats.bodies).toBe(1);
  expect(world.snapshot().stats.sleeping).toBe(1);
  expect(world.snapshot().stats.mass).toBeCloseTo(
    size.width * size.height * 25,
    8,
  );
  expect(world.snapshot().poses.every(Number.isFinite)).toBe(true);
});

it("grabs the enlarged plate beyond the old bounding box", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, { width: 4, height: 2 });
  world.apply({ type: "grab", point: { x: 6.5, y: 1 } });
  const before = world.snapshot().poses[16] ?? NaN;
  world.apply({ type: "release", velocity: { x: 3, y: 1 } });
  const after =
    world.advance(1 / 60, { x: 0, y: 0 }, live(10000)).poses[16] ?? NaN;
  expect((after - before) * 60).toBeCloseTo(3, 2);
});

it("rejects an oversized plate before constructing the world", () => {
  expect(
    () =>
      new RigidWorld("plate", DEFAULT_ENVIRONMENT, { width: 10, height: 1 }),
  ).toThrow("Invalid object size: width");
});
