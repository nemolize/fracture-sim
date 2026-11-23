import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, expect, it } from "vitest";

import { RigidTools } from "./interactions";
import { initializePhysics } from "./world";

beforeAll(initializePhysics);
let world: RAPIER.World | undefined;
afterEach(() => world?.free());
const setup = (bounds?: { width: number; height: number }) => {
  world = new RAPIER.World({ x: 0, y: 0 });
  const a = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(2, 2).setRotation(0.4),
  );
  const b = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(7, 2),
  );
  for (const body of [a, b])
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 0.5).setDensity(25),
      body,
    );
  const tools = new RigidTools(
    world,
    () =>
      [a, b].map((body) => ({
        body,
        polygon: [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, 0.5],
          [-0.5, 0.5],
        ],
      })),
    bounds,
  );
  return { world, tools, a, b };
};

it("selects a convex body, lifts it with a spring, and releases its pointer body", () => {
  const { world, tools, a } = setup();
  tools.move({ x: 2, y: 4 });
  tools.release({ x: 0, y: 0 });
  tools.start({ x: 0, y: 0 });
  tools.start({ x: 2, y: 2 });
  tools.move({ x: 2, y: 4 });
  for (let i = 0; i < 120; i++) world.step();
  expect(a.translation().y).toBeCloseTo(4, 1);
  expect(world.bodies.len()).toBe(3);
  tools.start(a.translation());
  expect(world.bodies.len()).toBe(3);
  tools.release({ x: 3, y: 1 });
  expect(world.bodies.len()).toBe(2);
  expect(a.linvel()).toEqual({ x: 3, y: 1 });
});

it("blasts nearby bodies outward, including a body at the centre, leaving distant bodies alone", () => {
  const { tools, a, b } = setup();
  tools.blast({ x: 1, y: 2 });
  expect(a.linvel().x).toBeGreaterThan(0);
  expect(b.linvel()).toEqual({ x: 0, y: 0 });
  a.setLinvel({ x: 0, y: 0 }, true);
  tools.blast({ x: 2, y: 2 });
  expect(a.linvel().y).toBeGreaterThan(0);
});

it("scales the blast reach with the world width, capped at 2 m", () => {
  const small = setup({ width: 2, height: 1 });
  small.tools.blast({ x: 1.8, y: 2 });
  expect(small.a.linvel().x).toBeCloseTo(4, 6);
  small.a.setLinvel({ x: 0, y: 0 }, true);
  small.tools.blast({ x: 1.6, y: 2 });
  expect(small.a.linvel().x).toBeCloseTo(0, 9);
  expect(small.a.linvel().y).toBeCloseTo(0, 9);
  small.world.free();
  const large = setup({ width: 30, height: 15 });
  large.tools.blast({ x: 0.5, y: 2 });
  expect(large.a.linvel().x).toBeCloseTo(8 * (1 - 1.5 / 2), 6);
  large.a.setLinvel({ x: 0, y: 0 }, true);
  large.tools.blast({ x: -0.1, y: 2 });
  expect(large.a.linvel().x).toBeCloseTo(0, 9);
  expect(large.a.linvel().y).toBeCloseTo(0, 9);
});
