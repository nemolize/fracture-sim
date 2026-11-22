/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { MIN_FRAGMENT_AREA } from "@/sim/fracture";

import { type BodyShape, polygonCollider } from "./body";
import { TIME_STEP } from "./constants";
import {
  DEFAULT_ENVIRONMENT,
  INITIAL_ENVIRONMENT,
  withWorldScale,
} from "./environment";
import { ImpactFracture, MAX_BODIES } from "./fracture";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
const PLATE = { width: 2, height: 1 };
const worlds: RigidWorld[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  worlds.splice(0).forEach((w) => {
    w.dispose();
  });
});
const makeRaisedPlateWorld = () => {
  const world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 2.5 }, true);
  world["world"].propagateModifiedBodyPositionsToColliders();
  worlds.push(world);
  return world;
};

it("separates drops below and above the crack threshold using real Rapier impulses", () => {
  for (const [height, breaks] of [
    [0.001, false],
    [0.15, true],
  ] as const) {
    const world = makeRaisedPlateWorld();
    world["shapes"][4]?.body.setTranslation({ x: 5, y: 0.5 + height }, true);
    for (let i = 0; i < 60; i++)
      world.advance(TIME_STEP, { x: 0, y: -9.8 }, 12);
    expect(world.snapshot().stats.bodies > 1).toBe(breaks);
    expect(world.snapshot().stats.mass).toBeCloseTo(50, 12);
  }
});

it("breaks two chunks colliding at 4 m/s and keeps their mass through subsequent impacts", () => {
  const engine = new RAPIER.World({ x: 0, y: 0 });
  const fracture = new ImpactFracture(MIN_FRAGMENT_AREA);
  fracture.setCrackEnergy(12);
  const shapes: BodyShape[] = [];
  const polygon = [
    [-0.4, -0.5],
    [0.4, -0.5],
    [0.4, 0.5],
    [-0.4, 0.5],
  ] as const;
  for (const [x, speed] of [
    [4.5, 2],
    [5.5, -2],
  ]) {
    const body = engine.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x ?? 0, 2)
        .setLinvel(speed ?? 0, 0)
        .setCcdEnabled(true),
    );
    engine.createCollider(polygonCollider(polygon).setMass(10), body);
    shapes.push({
      body,
      polygon,
      domain: polygon.map(([x, y]) => ({ x, y })),
      mass: 10,
      fixed: false,
      ball: false,
    });
  }
  const originals = shapes.map((s) => s.body.handle);
  try {
    for (let i = 0; i < 60; i++) fracture.step(engine, shapes, () => undefined);
    expect(shapes.length).toBeGreaterThan(2);
    expect(shapes.every((s) => !originals.includes(s.body.handle))).toBe(true);
    expect(shapes.reduce((s, p) => s + p.mass, 0)).toBeCloseTo(20, 12);
  } finally {
    fracture.dispose();
    engine.free();
  }
});

it("refuses balls at capacity without changing geometry or mass", () => {
  const world = new RigidWorld("stress");
  worlds.push(world);
  const before = world.snapshot();
  const vertices = world.vertices();
  expect(
    world.apply({
      type: "throw",
      point: { x: 5, y: 4 },
      velocity: { x: 0, y: 0 },
    }),
  ).toBe(false);
  expect(world.snapshot()).toEqual(before);
  expect(world.vertices()).toEqual(vertices);
});

it("retains the whole parent when full and retries its queued split when room appears", () => {
  const world = makeRaisedPlateWorld();
  for (let i = 1; i < MAX_BODIES; i++)
    world.apply({
      type: "throw",
      point: { x: 1, y: 4 },
      velocity: { x: 0, y: 0 },
    });
  const engine = world["world"];
  const shapes = world["shapes"];
  const parent = shapes[4];
  if (parent === undefined) throw new Error("Missing plate");
  // Park the extra balls without contacts so the test isolates pool saturation.
  for (const [i, s] of shapes.slice(5).entries())
    s.body.setTranslation({ x: 100 + i, y: 100 }, true);
  for (let i = 0; i < 50; i++) world.advance(TIME_STEP, { x: 0, y: -9.8 }, 12);
  expect(shapes[4]).toBe(parent);
  expect(world.snapshot().stats.bodies).toBe(MAX_BODIES);
  expect(world.snapshot().stats.mass).toBe(50 + 1999 * 2);
  const removed = shapes.splice(5, 40);
  for (const s of removed) engine.removeRigidBody(s.body);
  const remaining = world.snapshot().stats.mass;
  world.advance(TIME_STEP, { x: 0, y: 0 }, 12);
  expect(shapes.includes(parent)).toBe(false);
  expect(world.snapshot().stats.bodies).toBeLessThanOrEqual(MAX_BODIES);
  expect(world.snapshot().stats.mass).toBeCloseTo(remaining, 11);
});

it("keeps the parent and rolls back partial children if collider creation fails", () => {
  const world = makeRaisedPlateWorld();
  for (let i = 0; i < 30; i++) world.advance(TIME_STEP, { x: 0, y: -9.8 }, 12);
  const parent = world["shapes"][4];
  const count = world["world"].bodies.len();
  const create = world["world"].createCollider.bind(world["world"]);
  let calls = 0;
  vi.spyOn(world["world"], "createCollider").mockImplementation((...args) => {
    if (++calls === 2) throw new Error("allocation failed");
    return create(...args);
  });
  expect(() => {
    for (let i = 0; i < 20; i++)
      world.advance(TIME_STEP, { x: 0, y: -9.8 }, 12);
  }).toThrow("allocation failed");
  expect(world["shapes"][4]).toBe(parent);
  expect(world["world"].bodies.len()).toBe(count);
  expect(world.snapshot().stats.mass).toBe(50);
});

it("detaches a grabbed parent before replacing it, leaving later pointer actions safe", () => {
  const world = makeRaisedPlateWorld();
  world.apply({ type: "grab", point: { x: 5, y: 2.5 } });
  expect(world["world"].bodies.len()).toBe(6);
  world.apply({
    type: "throw",
    point: { x: 3, y: 2.5 },
    velocity: { x: 25, y: 0 },
  });
  for (let i = 0; i < 30; i++) world.advance(TIME_STEP, { x: 0, y: 0 }, 12);
  expect(world.snapshot().stats.bodies).toBeGreaterThan(2);
  expect(world["world"].bodies.len()).toBe(world.snapshot().stats.bodies + 4);
  expect(() =>
    world.apply({ type: "release", velocity: { x: 1, y: 0 } }),
  ).not.toThrow();
});

it("rejects malformed render geometry", () => {
  const world = makeRaisedPlateWorld();
  const shape = world["shapes"][4];
  if (shape === undefined) throw new Error("Missing plate");
  shape.polygon = [];
  expect(() => world.vertices()).toThrow("Invalid render polygon");
});

it.each([
  "missing-first",
  "missing-second",
  "null-point",
  "zero-impulse",
  "flipped",
])("ignores unusable contact data: %s", (mode) => {
  const world = makeRaisedPlateWorld();
  const engine = world["world"];
  const shapes = world["shapes"];
  const read = engine.contactPair.bind(engine);
  vi.spyOn(engine, "contactPair").mockImplementation((a, b, callback) => {
    read(a, b, (manifold, flipped) => {
      if (mode === "null-point") {
        vi.spyOn(manifold, "localContactPoint1").mockReturnValue(null);
        vi.spyOn(manifold, "localContactPoint2").mockReturnValue(null);
      }
      if (mode === "zero-impulse")
        vi.spyOn(manifold, "contactImpulse").mockReturnValue(0);
      callback(manifold, mode === "flipped" ? !flipped : flipped);
    });
  });
  if (mode.startsWith("missing")) {
    const body = engine.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(5, 0.55).setLinvel(0, -4),
    );
    const collider = engine.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.1).setActiveEvents(
        RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
      ),
      body,
    );
    if (mode === "missing-first") shapes.splice(0, 4);
    if (!collider.isValid()) throw new Error("Invalid fixture collider");
  }
  for (let i = 0; i < 60; i++) world.advance(TIME_STEP, { x: 0, y: -9.8 }, 12);
  expect(world.snapshot().poses.every(Number.isFinite)).toBe(true);
});

it.each([0, -12, NaN, Infinity, -Infinity])(
  "rejects invalid material toughness %s before advancing physics",
  (toughness) => {
    const world = makeRaisedPlateWorld();
    const before = world.snapshot();
    expect(() =>
      world.advance(TIME_STEP, { x: 0, y: -9.8 }, toughness),
    ).toThrow("Crack energy must be positive and finite");
    expect(world.snapshot()).toEqual(before);
  },
);

it("cancels a capacity-deferred split when the material changes", () => {
  const world = makeRaisedPlateWorld();
  for (let i = 1; i < MAX_BODIES; i++)
    world.apply({
      type: "throw",
      point: { x: 1, y: 4 },
      velocity: { x: 0, y: 0 },
    });
  const shapes = world["shapes"];
  const engine = world["world"];
  const parent = shapes[4];
  if (parent === undefined) throw new Error("Missing plate");
  for (const [i, s] of shapes.slice(5).entries())
    s.body.setTranslation({ x: 100 + i, y: 100 }, true);
  for (let i = 0; i < 50; i++) world.advance(TIME_STEP, { x: 0, y: -9.8 }, 12);
  expect(world["fracture"]["pending"].size).toBe(1);
  world.advance(0, { x: 0, y: -9.8 }, 1200);
  expect(world["fracture"]["pending"].size).toBe(0);
  for (const s of shapes.splice(5, 40)) engine.removeRigidBody(s.body);
  for (let i = 0; i < 60; i++)
    world.advance(TIME_STEP, { x: 0, y: -9.8 }, 1200);
  expect(shapes.includes(parent)).toBe(true);
});

const dropOnlyPileBox = (speed: number) => {
  const world = new RigidWorld("pile", INITIAL_ENVIRONMENT);
  worlds.push(world);
  const [box, ...others] = world["shapes"].filter((s) => !s.fixed);
  if (box === undefined) throw new Error("Missing pile box");
  for (const s of others) {
    world["world"].removeRigidBody(s.body);
    world["shapes"].splice(world["shapes"].indexOf(s), 1);
  }
  box.body.setTranslation({ x: 1, y: 0.1 }, true);
  box.body.setRotation(0, true);
  box.body.setLinvel({ x: 0, y: -speed }, true);
  let lowest = Infinity;
  for (let i = 0; i < 30; i++) {
    world.advance(TIME_STEP, { x: 0, y: 0 });
    if (world["shapes"].includes(box))
      lowest = Math.min(lowest, box.body.translation().y);
  }
  return { bodies: world.snapshot().stats.bodies, touchedFloor: lowest < 0.02 };
};

it("fractures a pile-sized box at the starting scale only under enough energy", () => {
  const weak = dropOnlyPileBox(0.3);
  expect(weak).toEqual({ bodies: 1, touchedFloor: true });
  expect(dropOnlyPileBox(20).bodies).toBeGreaterThan(1);
});

it("scales the minimum fragment area with the square of the world scale below ×1 and keeps it above", () => {
  for (const [scale, factor] of [
    [0.2, 0.04],
    [1, 1],
    [3, 1],
  ] as const) {
    const world = new RigidWorld(
      "plate",
      withWorldScale(DEFAULT_ENVIRONMENT, scale),
    );
    worlds.push(world);
    expect(world["fracture"]["minFragmentArea"]).toBeCloseTo(
      MIN_FRAGMENT_AREA * factor,
      12,
    );
  }
});

it("applies a changed minimum fragment area scaled by the world area factor", () => {
  const world = new RigidWorld(
    "plate",
    withWorldScale(DEFAULT_ENVIRONMENT, 0.5),
  );
  worlds.push(world);
  world.advance(0, { x: 0, y: -9.81 }, undefined, undefined, 0.004);
  expect(world["fracture"]["minFragmentArea"]).toBeCloseTo(0.004 * 0.25, 12);
});

it("rejects a non-positive minimum fragment area", () => {
  const world = new RigidWorld("plate");
  worlds.push(world);
  expect(() =>
    world.advance(0, { x: 0, y: -9.81 }, undefined, undefined, 0),
  ).toThrow("Minimum fragment area");
});

it("cancels a capacity-deferred split when the minimum fragment area changes", () => {
  const world = makeRaisedPlateWorld();
  for (let i = 1; i < MAX_BODIES; i++)
    world.apply({
      type: "throw",
      point: { x: 1, y: 4 },
      velocity: { x: 0, y: 0 },
    });
  for (const [i, s] of world["shapes"].slice(5).entries())
    s.body.setTranslation({ x: 100 + i, y: 100 }, true);
  for (let i = 0; i < 50; i++) world.advance(TIME_STEP, { x: 0, y: -9.8 }, 12);
  expect(world["fracture"]["pending"].size).toBe(1);
  world.advance(0, { x: 0, y: -9.8 }, 12, undefined, 0.004);
  expect(world["fracture"]["pending"].size).toBe(0);
});
