import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, expect, it } from "vitest";

import { RigidTools } from "./interactions";
import { initializePhysics } from "./world";

beforeAll(initializePhysics);
let world: RAPIER.World | undefined;
afterEach(() => world?.free());
const setup = () => {
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
  const tools = new RigidTools(world, () =>
    [a, b].map((body) => ({
      body,
      polygon: [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ],
    })),
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
