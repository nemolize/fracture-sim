/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DEFAULT_FLOOR_MATERIAL } from "@/sim/floor-material";
import { DEFAULT_MATERIAL } from "@/sim/material";

import {
  GRAVITY,
  TIME_STEP,
  WAKE_GRAVITY_DELTA,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_WORLD_SCALE,
  withWorldScale,
  WORLD_SCALE_RANGE,
} from "./environment";
import { live } from "./live";
import { DEFAULT_OBJECT_SIZE, fitObjectSize } from "./object-size";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(async () => {
  await initializePhysics();
  await initializePhysics();
});
let world: RigidWorld | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  world?.dispose();
  world = undefined;
});
const PLATE = { width: 2, height: 1 };
const gravity = { x: 0, y: -GRAVITY };

describe("rigid world", () => {
  it("keeps the real-glass default plate intact at floor level", () => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    const vertices = world.vertices();
    expect(vertices).toHaveLength(5 * 6 * 6);
    expect(world.snapshot().poses[17]).toBeCloseTo(0.5, 2);
    for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity);
    const { poses, stats } = world.snapshot();
    expect(poses.every(Number.isFinite)).toBe(true);
    expect(stats.bodies).toBe(1);
    expect(stats.sleeping).toBe(stats.bodies);
    expect(stats.mass).toBeCloseTo(50, 12);
    expect(world.vertices()).toEqual(vertices);
  });

  it("advances at a fixed 60 Hz, clamps stalls and leaves paused frames unchanged", () => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    const initial = world.snapshot();
    expect(world.advance(0, gravity)).toEqual(initial);
    expect(world.advance(-1, gravity)).toEqual(initial);
    expect(world.advance(TIME_STEP / 2, gravity).stats.time).toBe(0);
    expect(world.advance(TIME_STEP / 2, gravity).stats.time).toBe(TIME_STEP);
    expect(world.advance(10, gravity).stats.time).toBeCloseTo(7 * TIME_STEP);
  });

  it("wakes sleeping bodies when gravity tilts", () => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    for (let i = 0; i < 600; i++)
      world.advance(TIME_STEP, gravity, live(10000));
    expect(world.snapshot().stats.sleeping).toBe(world.snapshot().stats.bodies);
    const moved = world.advance(0.1, { x: GRAVITY, y: 0 }, live(10000));
    expect(moved.stats.sleeping).toBe(0);
    expect(moved.poses[16]).toBeGreaterThan(5);
  });

  describe("gravity jitter", () => {
    const settle = (): RigidWorld => {
      const settled = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
      for (let i = 0; i < 600; i++)
        settled.advance(TIME_STEP, gravity, live(10000));
      return settled;
    };

    it("keeps bodies asleep under jitter below the wake delta while applying the exact gravity", () => {
      world = settle();
      const jitter = WAKE_GRAVITY_DELTA / 3;
      for (let i = 0; i < 120; i++)
        world.advance(
          TIME_STEP,
          { x: i % 2 ? jitter : -jitter, y: -GRAVITY },
          live(10000),
        );
      expect(world.snapshot().stats.sleeping).toBe(1);
      expect(world["world"].gravity.x).toBeCloseTo(jitter, 12);
    });

    it("settles again under tilted-device jitter that exceeds half the wake delta", () => {
      world = settle();
      const amplitude = WAKE_GRAVITY_DELTA * 0.6;
      for (let i = 0; i < 900; i++)
        world.advance(
          TIME_STEP,
          { x: 0.3 + (i % 2 ? amplitude : -amplitude), y: -GRAVITY },
          live(10000),
        );
      expect(world.snapshot().stats.sleeping).toBe(1);
    });

    it("wakes on a slow drift once it passes the wake delta from the last wake", () => {
      world = settle();
      for (let i = 1; i <= 5; i++)
        for (let frame = 0; frame < 10; frame++)
          world.advance(
            TIME_STEP,
            { x: i * WAKE_GRAVITY_DELTA * 0.4, y: -GRAVITY },
            live(10000),
          );
      expect(world.snapshot().stats.sleeping).toBe(0);
    });

    it("wakes within a fraction of a second on a single step of the Gravity setting", () => {
      world = settle();
      for (let frame = 0; frame < 10; frame++)
        world.advance(TIME_STEP, { x: 0, y: -(GRAVITY + 0.1) }, live(10000));
      expect(world.snapshot().stats.sleeping).toBe(0);
    });
  });
});

it.each([
  ["floor", { x: 5, y: -0.3 }],
  ["left wall", { x: -0.3, y: 1 }],
  ["right wall", { x: WORLD_WIDTH + 0.3, y: 1 }],
  ["ceiling", { x: 5, y: WORLD_HEIGHT + 0.3 }],
])("lifts a body that sank into the %s back inside", (_side, position) => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  const body = world["shapes"][4]?.body;
  if (body === undefined) throw new Error("Missing plate");
  body.setTranslation(position, true);
  body.setLinvel({ x: 3, y: -3 }, true);
  world.advance(TIME_STEP, { x: 0, y: 0 }, live(10000));
  const { x, y } = body.translation();
  expect(x).toBeGreaterThan(0);
  expect(x).toBeLessThan(WORLD_WIDTH);
  expect(y).toBeGreaterThan(0);
  expect(y).toBeLessThan(WORLD_HEIGHT);
  expect(body.linvel()).toEqual({ x: 0, y: 0 });
});

it("refuses invalid convex geometry", () => {
  vi.spyOn(RAPIER.ColliderDesc, "convexHull").mockReturnValueOnce(null);
  expect(() => new RigidWorld(DEFAULT_ENVIRONMENT, PLATE)).toThrow(
    "Invalid convex body",
  );
});

it("reports a non-finite engine state", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  vi.spyOn(RAPIER.RigidBody.prototype, "rotation").mockReturnValueOnce(NaN);
  expect(() => world?.snapshot()).toThrow("Non-finite rigid-body state");
});

it("routes pointer actions and appends a ball with matching geometry and poses", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  expect(world.apply({ type: "grab", point: { x: 5, y: 0.5 } })).toBe(false);
  world.apply({ type: "move", point: { x: 5, y: 3.5 } });
  for (let i = 0; i < 60; i++) world.advance(TIME_STEP, gravity);
  expect(world.snapshot().poses[17]).toBeGreaterThan(3.3);
  world.apply({ type: "release", velocity: { x: 2, y: 0 } });
  world.apply({ type: "blast", point: { x: 4, y: 3.5 } });
  expect(
    world.apply({
      type: "throw",
      point: { x: 1, y: 1 },
      velocity: { x: 50, y: 0 },
    }),
  ).toBe(true);
  const initial = world.snapshot();
  expect(initial.stats.bodies).toBe(2);
  expect(world.vertices()).toHaveLength(5 * 6 * 6 + 18 * 6);
  const moved = world.advance(TIME_STEP, gravity);
  expect(moved.poses[20]).toBeGreaterThan(initial.poses[20] ?? Infinity);
});

it("keeps thrown balls inside even when the launch starts in the floor margin", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  world.apply({
    type: "throw",
    point: { x: 5, y: -0.35 },
    velocity: { x: 0, y: 0 },
  });
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity);
  const poses = world.snapshot().poses;
  expect(poses[poses.length - 3]).toBeGreaterThan(0.1);
});

it("keeps a grabbed plate above the floor when capture drags below the canvas", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 0.501 }, true);
  for (let i = 0; i < 600; i++) world.advance(TIME_STEP, gravity, live(10000));
  world.apply({ type: "grab", point: { x: 5, y: 0.5 } });
  world.apply({ type: "move", point: { x: 5, y: -3 } });
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity, live(10000));
  expect(world.snapshot().poses[17]).toBeGreaterThan(0.45);
});

it("can grab a thrown ball and keep it in the container", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  world.apply({
    type: "throw",
    point: { x: 1, y: 1 },
    velocity: { x: 0, y: 0 },
  });
  world.apply({ type: "grab", point: { x: 1, y: 1 } });
  world.apply({ type: "move", point: { x: -5, y: 2 } });
  for (let i = 0; i < 120; i++) world.advance(TIME_STEP, gravity);
  const poses = world.snapshot().poses;
  expect(poses[poses.length - 4]).toBeGreaterThan(0.1);
  expect(poses[poses.length - 3]).toBeCloseTo(2, 1);
});

it("builds selected walls, plate mass and throws within the new bounds", () => {
  const object = {
    ...DEFAULT_MATERIAL,
    density: 5000,
    friction: 0.8,
    restitution: 0.4,
  };
  world = new RigidWorld(
    { ...DEFAULT_ENVIRONMENT, width: 18, height: 8, gravity: 0 },
    PLATE,
    "rectangle",
    { floor: DEFAULT_FLOOR_MATERIAL, object },
  );
  expect(world.snapshot().poses[16]).toBe(9);
  expect(world.snapshot().poses[17]).toBeCloseTo(0.5, 2);
  expect(world.snapshot().stats.mass).toBe(100);
  world.apply({
    type: "throw",
    point: { x: 99, y: 99 },
    velocity: { x: 0, y: 0 },
  });
  const ball = world["shapes"].at(-1);
  expect(ball?.body.translation().x).toBeCloseTo(17.88);
  expect(ball?.body.translation().y).toBeCloseTo(7.88);
  expect(ball?.body.collider(0).friction()).toBeCloseTo(0.8);
  expect(ball?.body.collider(0).restitution()).toBeCloseTo(0.4);
  const ballMass = 50 * Math.PI * 0.12 ** 2;
  expect(ball?.mass).toBeCloseTo(ballMass, 12);
  expect(ball?.body.mass()).toBeCloseTo(ballMass, 6);
});

it.each([
  [0.01, 0.005],
  [DEFAULT_WORLD_SCALE, 0.1],
  [1, 0.12],
  [WORLD_SCALE_RANGE.max, 0.12],
])(
  "gives a ball at world scale ×%s (radius %s m) the areal-density mass of its own circle",
  (scale, radius) => {
    const environment = withWorldScale(DEFAULT_ENVIRONMENT, scale);
    world = new RigidWorld(
      environment,
      fitObjectSize(DEFAULT_OBJECT_SIZE, environment),
    );
    world.apply({
      type: "throw",
      point: { x: 1, y: 1 },
      velocity: { x: 0, y: 0 },
    });
    const expected = 25 * Math.PI * radius ** 2;
    const ball = world["shapes"].at(-1);
    expect(ball?.mass).toBeCloseTo(expected, 12);
    expect(ball?.body.mass()).toBeCloseTo(expected, 6);
  },
);

it("keeps friction and restitution on recursively created fragments", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  world["shapes"][4]?.body.setTranslation({ x: 5, y: 2.5 }, true);
  const object = { ...DEFAULT_MATERIAL, friction: 0.83, restitution: 0.4 };
  for (let i = 0; i < 120; i++)
    world.advance(TIME_STEP, gravity, live(0.07, { object }));
  expect(world.snapshot().stats.bodies).toBeGreaterThan(1);
  for (const shape of world["shapes"].filter((s) => !s.fixed)) {
    expect(shape.body.collider(0).friction()).toBeCloseTo(0.83);
    expect(shape.body.collider(0).restitution()).toBeCloseTo(0.4);
  }
});

it("uses selected grab limits beyond the old right wall and ceiling", () => {
  world = new RigidWorld(
    {
      ...DEFAULT_ENVIRONMENT,
      width: 18,
      height: 8,
    },
    PLATE,
  );
  world.apply({ type: "grab", point: { x: 9, y: 0.5 } });
  world.apply({ type: "move", point: { x: 16, y: 7 } });
  for (let i = 0; i < 240; i++)
    world.advance(TIME_STEP, { x: 0, y: 0 }, live(10000));
  expect(world.snapshot().poses[16]).toBeCloseTo(16, 1);
  expect(world.snapshot().poses[17]).toBeCloseTo(7, 1);
});

it("builds the plate at the minimum world scale with the default object size", () => {
  const environment = withWorldScale(
    DEFAULT_ENVIRONMENT,
    WORLD_SCALE_RANGE.min,
  );
  world = new RigidWorld(environment);
  for (let i = 0; i < 5; i++) world.advance(0.1, gravity);
  expect(world.snapshot().poses.every(Number.isFinite)).toBe(true);
});

const surfaceCases = [
  ["friction", NaN],
  ["friction", Infinity],
  ["friction", -0.1],
  ["friction", 2.1],
  ["restitution", -0.1],
  ["restitution", 1.1],
] as const;

it.each(surfaceCases)(
  "rejects an invalid live floor and object %s of %s",
  (key, value) => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    const bad = { ...DEFAULT_MATERIAL, [key]: value };
    expect(() =>
      world?.advance(0, gravity, live(10000, { object: bad })),
    ).toThrow(`Invalid material setting: ${key}`);
    expect(() =>
      world?.advance(0, gravity, live(10000, { floor: bad })),
    ).toThrow(`Invalid material setting: ${key}`);
  },
);

it("rejects an invalid material at construction", () => {
  expect(
    () =>
      new RigidWorld(DEFAULT_ENVIRONMENT, PLATE, "rectangle", {
        floor: DEFAULT_FLOOR_MATERIAL,
        object: { ...DEFAULT_MATERIAL, density: 1 },
      }),
  ).toThrow("Invalid material setting: areal density");
  expect(
    () =>
      new RigidWorld(DEFAULT_ENVIRONMENT, PLATE, "rectangle", {
        floor: { ...DEFAULT_FLOOR_MATERIAL, friction: 3 },
        object: DEFAULT_MATERIAL,
      }),
  ).toThrow("Invalid material setting: friction");
});

it("gives the floor, the object and the boundary their own surfaces", () => {
  const floor = { ...DEFAULT_FLOOR_MATERIAL, friction: 1.2, restitution: 0.8 };
  const object = { ...DEFAULT_MATERIAL, friction: 0.2, restitution: 0.1 };
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE, "rectangle", {
    floor,
    object,
  });
  const surfaces = world["shapes"].map(({ body }) => [
    body.collider(0).friction(),
    body.collider(0).restitution(),
  ]);
  const expected = [
    [1.2, 0.8],
    [0.5, 0],
    [0.5, 0],
    [0.5, 0],
    [0.2, 0.1],
  ];
  surfaces.forEach(([friction, restitution], i) => {
    expect(friction).toBeCloseTo(expected[i]?.[0] ?? NaN, 5);
    expect(restitution).toBeCloseTo(expected[i]?.[1] ?? NaN, 5);
  });
});

it("scales body mass with the object's density and thickness", () => {
  const masses = [10, 20].map((thicknessMm) => {
    const built = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE, "rectangle", {
      floor: DEFAULT_FLOOR_MATERIAL,
      object: { ...DEFAULT_MATERIAL, thicknessMm },
    });
    const { mass } = built.snapshot().stats;
    built.dispose();
    return mass;
  });
  expect(masses[0]).toBeCloseTo(25 * 2 * 1);
  expect(masses[1]).toBeCloseTo(2 * (masses[0] ?? NaN));
});

it("applies a live floor change to the floor only and wakes the bodies", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  const floor = { ...DEFAULT_FLOOR_MATERIAL, friction: 1.5, restitution: 0.6 };
  expect(world["shapes"][4]?.body.isSleeping()).toBe(true);
  world.advance(0, gravity, live(10000, { floor }));
  const [floorShape, , , , plate] = world["shapes"];
  expect(floorShape?.body.collider(0).friction()).toBeCloseTo(1.5, 5);
  expect(floorShape?.body.collider(0).restitution()).toBeCloseTo(0.6, 5);
  expect(plate?.body.collider(0).friction()).toBe(0.5);
  expect(plate?.body.isSleeping()).toBe(false);
});

it("applies a live object change to every dynamic body but not the walls", () => {
  world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
  const object = { ...DEFAULT_MATERIAL, friction: 0, restitution: 0.7 };
  world.advance(0, gravity, live(10000, { object }));
  const [floor, ...rest] = world["shapes"];
  expect(floor?.body.collider(0).friction()).toBeCloseTo(
    DEFAULT_FLOOR_MATERIAL.friction,
    5,
  );
  expect(floor?.body.collider(0).restitution()).toBeCloseTo(
    DEFAULT_FLOOR_MATERIAL.restitution,
    5,
  );
  for (const { body, fixed } of rest) {
    expect(body.collider(0).friction()).toBe(fixed ? 0.5 : 0);
    expect(body.collider(0).restitution()).toBeCloseTo(fixed ? 0 : 0.7, 5);
  }
});

it("a bouncier floor and object make a dropped plate rebound", () => {
  const rebound = [0, 0.9].map((restitution) => {
    const floor = { ...DEFAULT_FLOOR_MATERIAL, restitution };
    const object = { ...DEFAULT_MATERIAL, restitution };
    const built = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE, "rectangle", {
      floor,
      object,
    });
    const body = built["shapes"][4]?.body;
    if (body === undefined) throw new Error("Missing plate");
    body.setTranslation({ x: 5, y: 2 }, true);
    let top = 0;
    for (let i = 0; i < 180; i++) {
      built.advance(TIME_STEP, gravity, live(1e9, { floor, object }));
      if (i >= 36) top = Math.max(top, body.translation().y);
    }
    built.dispose();
    return top;
  });
  expect(rebound[1]).toBeGreaterThan((rebound[0] ?? NaN) + 0.2);
});

it("live friction slows a sliding plate while zero friction preserves its speed", () => {
  const distances: number[] = [];
  for (const friction of [0, 1]) {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    for (let i = 0; i < 600; i++)
      world.advance(TIME_STEP, gravity, live(10000));
    const body = world["shapes"][4]?.body;
    if (body === undefined) throw new Error("Missing plate");
    const start = body.translation().x;
    body.setLinvel({ x: 5, y: 0 }, true);
    const surface = { ...DEFAULT_MATERIAL, friction };
    const floor = { ...DEFAULT_FLOOR_MATERIAL, friction };
    for (let i = 0; i < 30; i++)
      world.advance(
        TIME_STEP,
        gravity,
        live(10000, { object: surface, floor }),
      );
    distances.push(body.translation().x - start);
    world.dispose();
    world = undefined;
  }
  expect(distances[0]).toBeGreaterThan(2.4);
  expect(distances[1]).toBeLessThan(1.5);
});

describe("visible height", () => {
  it("lets a body rise to a ceiling raised to the visible height", () => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    world.setVisibleHeight(12);
    world.apply({ type: "grab", point: { x: 5, y: 0.5 } });
    world.apply({ type: "move", point: { x: 5, y: 11 } });
    for (let i = 0; i < 240; i++)
      world.advance(TIME_STEP, { x: 0, y: 0 }, live(10000));
    expect(world.snapshot().poses[17]).toBeCloseTo(11, 1);
  });

  it("clamps throws to the visible height", () => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    world.setVisibleHeight(12);
    world.apply({
      type: "throw",
      point: { x: 5, y: 99 },
      velocity: { x: 0, y: 0 },
    });
    expect(world["shapes"].at(-1)?.body.translation().y).toBeCloseTo(11.88);
  });

  it("keeps the configured height when the view is shorter", () => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    world.setVisibleHeight(2);
    world.apply({
      type: "throw",
      point: { x: 5, y: 99 },
      velocity: { x: 0, y: 0 },
    });
    expect(world["shapes"].at(-1)?.body.translation().y).toBeCloseTo(
      WORLD_HEIGHT - 0.12,
    );
  });

  it("keeps the walls tall enough after the ceiling moves", () => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    world.setVisibleHeight(20);
    world["shapes"][4]?.body.setTranslation({ x: 9.7, y: 15 }, true);
    world["shapes"][4]?.body.setLinvel({ x: 30, y: 0 }, true);
    for (let i = 0; i < 120; i++)
      world.advance(TIME_STEP, { x: 0, y: 0 }, live(10000));
    expect(world.snapshot().poses[16]).toBeLessThan(WORLD_WIDTH);
  });

  it("rejects an invalid height and ignores an unchanged one", () => {
    world = new RigidWorld(DEFAULT_ENVIRONMENT, PLATE);
    expect(() => {
      world?.setVisibleHeight(Number.NaN);
    }).toThrow("Invalid visible height");
    expect(() => {
      world?.setVisibleHeight(-1);
    }).toThrow("Invalid visible height");
    world.setVisibleHeight(WORLD_HEIGHT);
    expect(world["environment"].height).toBe(WORLD_HEIGHT);
  });
});
