/* eslint-disable @typescript-eslint/dot-notation -- Inspect actual engine velocities and contact ordering. */
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { DEFAULT_FLOOR_MATERIAL } from "@/sim/floor-material";
import { DEFAULT_MATERIAL } from "@/sim/material";

import { DEFAULT_ENVIRONMENT } from "./environment";
import { live } from "./live";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
const PLATE = { width: 2, height: 1 };
let world: RigidWorld | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  world?.dispose();
  world = undefined;
});

it.each([
  ["horizontal sensor noise", { x: 0.01, y: -9.8 }, 0.5],
  ["vertical sensor noise", { x: 0, y: -9.81 }, 0.5],
  ["friction update", { x: 0, y: -9.8 }, 0.51],
])("keeps awake Glass intact under %s", (_label, gravity, friction) => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  const surface = { friction, restitution: 0 };
  for (let i = 0; i < 600; i++)
    world.advance(
      1 / 60,
      gravity,
      live(undefined, {
        floor: { ...DEFAULT_FLOOR_MATERIAL, ...surface },
        object: { ...DEFAULT_MATERIAL, ...surface },
      }),
    );
  expect(world.snapshot().stats.bodies).toBe(1);
  expect(world.snapshot().stats.mass).toBe(50);
  expect(world.snapshot().poses[17]).toBeCloseTo(0.5, 2);
});

it.each([
  { width: 0.1, height: 0.1 },
  { width: 0.1, height: 5.1 },
  { width: 9.9, height: 0.1 },
  { width: 9.9, height: 5.1 },
])(
  "keeps a supported $width × $height object intact under changing readings",
  (size) => {
    world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, size);
    for (let i = 0; i < 300; i++)
      world.advance(1 / 60, {
        x: Math.sin(i) * 0.01,
        y: -9.8 + Math.cos(i) * 0.01,
      });
    expect(world.snapshot().stats.bodies).toBe(1);
    expect(world.snapshot().stats.mass).toBeCloseTo(
      size.width * size.height * 25,
      8,
    );
    expect(world.snapshot().poses.every(Number.isFinite)).toBe(true);
  },
);

it("still breaks real Glass after a physical 15 cm drop", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 0.65 }, true);
  for (let i = 0; i < 120; i++) world.advance(1 / 60, { x: 0, y: -9.8 });
  expect(world.snapshot().stats.bodies).toBeGreaterThan(1);
  expect(world.snapshot().stats.mass).toBeCloseTo(50, 12);
});

it("handles a real manifold whose requested collider order is reversed", () => {
  world = new RigidWorld("plate", DEFAULT_ENVIRONMENT, PLATE);
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 0.65 }, true);
  const engine = world["world"];
  const contact = engine.contactPair.bind(engine);
  vi.spyOn(engine, "contactPair").mockImplementation((a, b, callback) => {
    contact(b, a, (manifold, flipped) => {
      callback(manifold, !flipped);
    });
  });
  for (let i = 0; i < 120; i++) world.advance(1 / 60, { x: 0, y: -9.8 });
  expect(world.snapshot().stats.bodies).toBeGreaterThan(1);
  expect(world.snapshot().stats.mass).toBeCloseTo(50, 12);
});
