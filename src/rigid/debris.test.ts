import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, expect, it } from "vitest";

import { DEBRIS_STRIDE, MAX_DEBRIS, TIME_STEP } from "./constants";
import { DebrisRegistry, type DebrisSpec } from "./debris";
import { initializePhysics } from "./world";

beforeAll(initializePhysics);

const RADIUS = 0.05;
const engines: RAPIER.World[] = [];
afterEach(() => {
  engines.splice(0).forEach((engine) => {
    engine.free();
  });
});

const circle = (x: number, y: number, mass = 1): DebrisSpec => ({
  position: { x, y },
  velocity: { x: 0, y: 0 },
  angularVelocity: 0,
  radius: RADIUS,
  mass,
  friction: 0.5,
  restitution: 0,
});

const makeWorld = (gravity = -9.8) => {
  const engine = new RAPIER.World({ x: 0, y: gravity });
  engines.push(engine);
  engine.timestep = TIME_STEP;
  const floor = engine.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(5, -0.2),
  );
  engine.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.2), floor);
  return { engine, debris: new DebrisRegistry(engine) };
};

const run = (engine: RAPIER.World, seconds: number) => {
  for (let i = 0; i < seconds / TIME_STEP; i++) engine.step();
};

it("reports each circle's centre and diameter", () => {
  const { debris } = makeWorld();
  debris.spawn(circle(1, 2));
  debris.spawn({ ...circle(3, 4), radius: 0.1 });
  const snapshot = debris.snapshot();
  expect(debris.size).toBe(2);
  expect(Array.from(snapshot)).toEqual(
    [1, 2, 0.1, 3, 4, 0.2].map((v) => Math.fround(v)),
  );
});

it("keeps a resting circle indefinitely instead of expiring it", () => {
  const { engine, debris } = makeWorld();
  debris.spawn(circle(5, 0.5));
  run(engine, 10);
  expect(debris.size).toBe(1);
  expect(debris.snapshot()[1]).toBeCloseTo(RADIUS, 2);
});

it("replaces the oldest circle at capacity and drops its mass", () => {
  const { engine, debris } = makeWorld(0);
  const extra = 3;
  for (let i = 0; i < MAX_DEBRIS + extra; i++)
    debris.spawn(
      circle(0.1 + (i % 100) * 0.09, 1 + Math.floor(i / 100) * 0.1, 1 + i),
    );
  expect(debris.size).toBe(MAX_DEBRIS);
  let expected = 0;
  for (let i = extra; i < MAX_DEBRIS + extra; i++) expected += 1 + i;
  expect(debris.mass).toBe(expected);
  const snapshot = debris.snapshot();
  let firstRow = 0;
  for (let i = 0; i < MAX_DEBRIS; i++)
    if (Math.abs((snapshot[i * DEBRIS_STRIDE + 1] ?? 0) - 1) < 1e-6) firstRow++;
  expect(firstRow).toBe(100 - extra);
  expect(engine.bodies.len()).toBe(MAX_DEBRIS + 1);
});

const bodiesOf = (engine: RAPIER.World): RAPIER.RigidBody[] => {
  const found: RAPIER.RigidBody[] = [];
  engine.forEachRigidBody((body) => {
    if (!body.isFixed()) found.push(body);
  });
  return found;
};

it("holds a dropped body on a deep pile above the floor", () => {
  const { engine, debris } = makeWorld();
  for (let row = 0; row < 10; row++)
    for (let column = 0; column < 20; column++)
      debris.spawn(circle(4 + column * 0.11, RADIUS + row * 0.1));
  const box = engine.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(5.1, 2).setCcdEnabled(true),
  );
  engine.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.1).setMass(5), box);
  run(engine, 4);
  expect(box.translation().y).toBeGreaterThan(0.5);
});

it("exchanges momentum and spin with a body hit off-centre", () => {
  const { engine, debris } = makeWorld(0);
  const box = engine.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(8, 3),
  );
  engine.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3).setMass(1), box);
  debris.spawn({ ...circle(7.4, 3.2, 2), velocity: { x: 6, y: 0 } });
  run(engine, 0.5);
  const [ball] = bodiesOf(engine).filter((body) => body !== box);
  if (ball === undefined) throw new Error("Missing debris body");
  expect(box.linvel().x).toBeGreaterThan(1);
  expect(Math.abs(box.angvel())).toBeGreaterThan(0.1);
  const momentum = {
    x: 2 * ball.linvel().x + box.linvel().x,
    y: 2 * ball.linvel().y + box.linvel().y,
  };
  expect(momentum.x).toBeCloseTo(12, 3);
  expect(momentum.y).toBeCloseTo(0, 3);
});

it("sets a sliding circle spinning only when friction acts", () => {
  const spins = [0, 0.9].map((friction) => {
    const { engine, debris } = makeWorld();
    engine.forEachCollider((collider) => {
      collider.setFriction(friction);
    });
    debris.spawn({
      ...circle(2, RADIUS),
      velocity: { x: 3, y: 0 },
      friction,
    });
    run(engine, 0.3);
    const [ball] = bodiesOf(engine);
    return Math.abs(ball?.angvel() ?? Number.NaN);
  });
  expect(spins[0]).toBeCloseTo(0, 3);
  expect(spins[1]).toBeGreaterThan(1);
});

it("wakes a circle that has gone to sleep", () => {
  const { engine, debris } = makeWorld();
  debris.spawn(circle(5, RADIUS));
  run(engine, 3);
  const sleeping = (): boolean[] => {
    const states: boolean[] = [];
    engine.forEachRigidBody((body) => {
      if (!body.isFixed()) states.push(body.isSleeping());
    });
    return states;
  };
  expect(sleeping()).toEqual([true]);
  debris.wake();
  expect(sleeping()).toEqual([false]);
});

it("applies a new surface to every circle", () => {
  const { engine, debris } = makeWorld();
  debris.spawn(circle(1, 1));
  debris.spawn(circle(2, 1));
  debris.setSurface(0.9, 0.3);
  engine.forEachCollider((collider) => {
    if (collider.parent()?.isFixed() === true) return;
    expect(collider.friction()).toBeCloseTo(0.9, 6);
    expect(collider.restitution()).toBeCloseTo(0.3, 6);
  });
});

it("puts a circle that left the container back inside it, at rest", () => {
  const { debris } = makeWorld();
  debris.spawn({ ...circle(-1, 7), velocity: { x: -3, y: 4 } });
  debris.contain(10, 5);
  const [x, y] = debris.snapshot();
  expect([x, y]).toEqual([Math.fround(RADIUS), Math.fround(5 - RADIUS)]);
});

it("does not move a circle that is already inside the container", () => {
  const { debris } = makeWorld();
  debris.spawn(circle(2, 1));
  debris.contain(10, 5);
  expect(Array.from(debris.snapshot().subarray(0, 2))).toEqual([2, 1]);
});

it("refuses to report a circle whose position is not finite", () => {
  const { engine, debris } = makeWorld();
  debris.spawn(circle(1, 1));
  engine.forEachRigidBody((body) => {
    if (!body.isFixed()) body.setTranslation({ x: Number.NaN, y: 1 }, true);
  });
  expect(() => debris.snapshot()).toThrow("Non-finite debris state");
});
