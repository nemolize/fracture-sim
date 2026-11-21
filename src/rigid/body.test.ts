import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { createBodyShape, polygonCollider } from "./body";
import { objectPolygon } from "./object-shape";
import { initializePhysics } from "./world";

beforeAll(initializePhysics);
let world: RAPIER.World | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  world?.free();
  world = undefined;
});
it("removes only its new rigid body if collider creation fails", () => {
  const engine = new RAPIER.World({ x: 0, y: 0 });
  world = engine;
  const existing = engine.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  vi.spyOn(engine, "createCollider").mockImplementationOnce(() => {
    throw new Error("allocation failed");
  });
  expect(() =>
    createBodyShape(
      engine,
      objectPolygon("triangle", { width: 2, height: 1 }),
      { x: 0, y: 1 },
      25,
      0.5,
      false,
    ),
  ).toThrow("allocation failed");
  expect(world.bodies.len()).toBe(1);
  expect(existing.isValid()).toBe(true);
});

it.each([
  { polygon: [] },
  { polygon: [[0, 0]] },
  {
    polygon: [
      [0, 0],
      [1, 0],
    ],
  },
] as const)("rejects too few polygon vertices: $polygon", ({ polygon }) => {
  expect(() => polygonCollider(polygon)).toThrow("Invalid convex body");
});

it("falls back when the native descriptor has no polygon vertices", () => {
  world = new RAPIER.World({ x: 0, y: 0 });
  vi.spyOn(RAPIER.ColliderDesc, "convexHull").mockReturnValueOnce(
    RAPIER.ColliderDesc.ball(1),
  );
  const shape = createBodyShape(
    world,
    objectPolygon("hexagon", { width: 2, height: 1 }),
    { x: 0, y: 1 },
    25,
    0.5,
    false,
  );
  expect(shape.body.collider(0).shapeType()).toBe(RAPIER.ShapeType.Compound);
  expect(shape.body.mass()).toBeCloseTo(37.5, 4);
});
