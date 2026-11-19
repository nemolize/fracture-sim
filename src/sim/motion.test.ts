import { describe, expect, it } from "vitest";

import { GRAVITY } from "@/rigid/constants";

import {
  type Axes,
  hasReading,
  MotionTracker,
  readMotion,
  toScreenFrame,
} from "./motion";

const axes = (x: number | null, y: number | null, z: number | null): Axes => ({
  x,
  y,
  z,
});
const reading = (
  accelerationIncludingGravity: Axes | null,
  acceleration: Axes | null = null,
) => ({ accelerationIncludingGravity, acceleration });
const TUNING = { inertiaScale: 1, inertiaCap: 100 };
const ZERO = { x: 0, y: 0, z: 0 };
const DOWN = { x: 0, y: -GRAVITY, z: 0 };
const UP = { x: 0, y: GRAVITY, z: 0 };
const RIGHT = { x: GRAVITY, y: 0, z: 0 };

describe("toScreenFrame", () => {
  it.each([
    [0, { x: 2, y: 3 }],
    [90, { x: -3, y: 2 }],
    [180, { x: -2, y: -3 }],
    [270, { x: 3, y: -2 }],
    [360, { x: 2, y: 3 }],
    [-90, { x: 3, y: -2 }],
  ])("turns a vector for screen angle %s", (angle, expected) => {
    expect(toScreenFrame({ x: 2, y: 3 }, angle)).toEqual(expected);
  });
});

describe("3D acceleration readings", () => {
  it("recognizes complete readings including a flat device and zero acceleration", () => {
    expect(hasReading(reading(axes(0, 0, GRAVITY)))).toBe(true);
    expect(hasReading(reading(ZERO))).toBe(true);
  });
  it.each([
    null,
    axes(null, 1, 0),
    axes(0, null, 1),
    axes(NaN, 1, 0),
    axes(0, Infinity, 1),
  ])("ignores incomplete or non-finite gravity axes: %j", (input) => {
    expect(hasReading(reading(input))).toBe(false);
    expect(readMotion(reading(input), 0, false).gravity).toBeNull();
  });
  it.each([
    [axes(0, GRAVITY, 0), DOWN],
    [axes(0, -GRAVITY, 0), UP],
    [axes(-GRAVITY, 0, 0), RIGHT],
    [axes(GRAVITY, 0, 0), { x: -GRAVITY, y: 0, z: 0 }],
    [axes(0, 0, GRAVITY), { x: 0, y: 0, z: -GRAVITY }],
    [axes(0, 0, -GRAVITY), { x: 0, y: 0, z: GRAVITY }],
    [axes(0, 3, 4), { x: 0, y: -3, z: -4 }],
    [axes(0, 30, 40), { x: 0, y: -30, z: -40 }],
    [ZERO, ZERO],
  ])(
    "preserves all three axes and their measured magnitude for %j",
    (input, expected) => {
      const gravity = readMotion(reading(input), 0, false).gravity;
      expect(gravity?.x).toBeCloseTo(expected.x);
      expect(gravity?.y).toBeCloseTo(expected.y);
      expect(gravity?.z).toBeCloseTo(expected.z);
    },
  );
  it("rotates XY for the screen without changing Z or rescaling", () => {
    const gravity = readMotion(reading(axes(3, 0, 4)), 90, false).gravity;
    expect(gravity?.x).toBeCloseTo(0);
    expect(gravity?.y).toBeCloseTo(-3);
    expect(gravity?.z).toBeCloseTo(-4);
  });
  it("subtracts linear acceleration on every axis while keeping shake separate", () => {
    const sample = readMotion(
      reading(axes(-20, 3, 9), axes(-20, 0, 5)),
      0,
      false,
    );
    expect(sample.gravity).toEqual({ x: 0, y: -3, z: -4 });
    expect(sample.acceleration).toEqual({ x: -20, y: 0 });
  });
  it("preserves iOS sign correction on all three axes", () => {
    const sample = readMotion(
      reading(axes(1, -5, -9), axes(1, -2, -5)),
      0,
      true,
    );
    expect(sample.gravity).toEqual({ x: 0, y: -3, z: -4 });
    expect(sample.acceleration).toEqual({ x: -1, y: 2 });
  });
  it("rejects unrepresentable gravity differences", () => {
    expect(
      readMotion(reading(axes(-1e308, 0, 0), axes(1e308, 0, 0)), 0, false)
        .gravity,
    ).toBeNull();
  });
  it("keeps screen-plane shake independent of the gravity reading", () => {
    expect(
      readMotion(reading(null, axes(1, 2, null)), 90, false).acceleration,
    ).toEqual({ x: -2, y: 1 });
    expect(readMotion(reading(null), 0, false).acceleration).toBeNull();
    expect(
      readMotion(reading(null, axes(null, 0, 0)), 0, false).acceleration,
    ).toBeNull();
  });
});

describe("3D acceleration tracker", () => {
  it("starts downward and immediately adopts the first measured vector without normalizing", () => {
    const tracker = new MotionTracker();
    expect(tracker.gravity(TUNING, 0)).toEqual({ x: 0, y: -GRAVITY });
    tracker.update(
      { gravity: { x: 3, y: 4, z: 12 }, acceleration: null },
      1000,
      0.5,
    );
    expect(tracker.gravity(TUNING, 1000)).toEqual({ x: 3, y: 4 });
  });
  it("low-pass filters all axes without rescaling the result", () => {
    const tracker = new MotionTracker();
    tracker.update({ gravity: DOWN, acceleration: null }, 0, 0.1);
    tracker.update({ gravity: RIGHT, acceleration: null }, 100, 0.1);
    const retained = Math.exp(-1),
      added = 1 - retained;
    const result = tracker.gravity(TUNING, 100);
    expect(result.x).toBeCloseTo(GRAVITY * added);
    expect(result.y).toBeCloseTo(-GRAVITY * retained);
  });
  it("responds immediately when smoothing is zero", () => {
    const tracker = new MotionTracker();
    tracker.update({ gravity: DOWN, acceleration: null }, 0, 0);
    tracker.update({ gravity: UP, acceleration: null }, 1, 0);
    expect(tracker.gravity(TUNING, 1)).toEqual({ x: 0, y: GRAVITY });
  });
  it("converges upward with smoothing even without intermediate rotation samples", () => {
    const tracker = new MotionTracker();
    tracker.update({ gravity: DOWN, acceleration: null }, 0, 1);
    for (let i = 1; i <= 120; i++)
      tracker.update({ gravity: UP, acceleration: null }, i * 16, 1);
    expect(tracker.gravity(TUNING, 1920).y).toBeGreaterThan(0);
  });
  it("can pass through zero during an exact reversal and recover normally", () => {
    const tracker = new MotionTracker();
    tracker.update({ gravity: DOWN, acceleration: null }, 0, 1);
    tracker.update({ gravity: UP, acceleration: null }, 1000 * Math.log(2), 1);
    expect(tracker.gravity(TUNING, 1000 * Math.log(2)).y).toBeCloseTo(0);
    tracker.update({ gravity: UP, acceleration: null }, 1000, 1);
    expect(tracker.gravity(TUNING, 1000).y).toBeGreaterThan(0);
  });
  it("crosses upside down without a sideways clamp or angle seam", () => {
    const tracker = new MotionTracker();
    tracker.update(
      { gravity: { x: 0.01, y: GRAVITY, z: 0 }, acceleration: null },
      0,
      0.1,
    );
    tracker.update(
      { gravity: { x: -0.01, y: GRAVITY, z: 0 }, acceleration: null },
      10,
      0.1,
    );
    expect(tracker.gravity(TUNING, 10).y).toBeCloseTo(GRAVITY);
  });
  it("projects flat acceleration to zero instead of holding the last tilt", () => {
    const tracker = new MotionTracker();
    tracker.update({ gravity: RIGHT, acceleration: null }, 0, 0);
    tracker.update(
      { gravity: { x: 0, y: 0, z: -GRAVITY }, acceleration: null },
      10,
      0,
    );
    expect(tracker.gravity(TUNING, 10)).toEqual({ x: 0, y: 0 });
    tracker.update({ gravity: null, acceleration: null }, 20, 0);
    expect(tracker.gravity(TUNING, 20)).toEqual({ x: 0, y: 0 });
  });
  it("keeps the screen-plane magnitude of an out-of-plane measurement", () => {
    const tracker = new MotionTracker();
    tracker.update(readMotion(reading(axes(0, 3, 4)), 0, false), 0, 0);
    expect(tracker.gravity(TUNING, 0)).toEqual({ x: 0, y: -3 });
  });
  it("scales shake separately and caps it without changing direction", () => {
    const tracker = new MotionTracker();
    tracker.update({ gravity: DOWN, acceleration: { x: 3, y: -1 } }, 0, 0);
    expect(tracker.gravity({ inertiaScale: 2, inertiaCap: 100 }, 0)).toEqual({
      x: -6,
      y: -GRAVITY + 2,
    });
    tracker.update({ gravity: DOWN, acceleration: { x: 30, y: 40 } }, 10, 0);
    expect(tracker.gravity({ inertiaScale: 1, inertiaCap: 5 }, 10)).toEqual({
      x: -3,
      y: -GRAVITY - 4,
    });
  });
  it("drops shake when missing or stale but keeps the last gravity reading", () => {
    const tracker = new MotionTracker();
    tracker.update({ gravity: RIGHT, acceleration: { x: 3, y: 0 } }, 0, 0);
    expect(tracker.gravity(TUNING, 500).x).toBeCloseTo(GRAVITY - 3);
    expect(tracker.gravity(TUNING, 501).x).toBeCloseTo(GRAVITY);
    tracker.update({ gravity: null, acceleration: null }, 600, 0);
    expect(tracker.gravity(TUNING, 600)).toEqual({ x: GRAVITY, y: 0 });
  });
  it("resets the acceleration vector and filter clock", () => {
    const tracker = new MotionTracker();
    tracker.update({ gravity: RIGHT, acceleration: { x: 3, y: 3 } }, 0, 0);
    tracker.reset();
    expect(tracker.gravity(TUNING, 0)).toEqual({ x: 0, y: -GRAVITY });
    tracker.update({ gravity: UP, acceleration: null }, 50, 5);
    expect(tracker.gravity(TUNING, 50)).toEqual({ x: 0, y: GRAVITY });
  });
});

it.each([
  [0, null],
  [null, 0],
  [null, null],
  [NaN, null],
])(
  "keeps planar force independent of missing Z (reaction %s, linear %s)",
  (reactionZ, linearZ) => {
    const tracker = new MotionTracker();
    tracker.update(
      readMotion(
        reading(axes(-3, GRAVITY, reactionZ), axes(2, 0, linearZ)),
        0,
        false,
      ),
      0,
      0,
    );
    expect(tracker.gravity(TUNING, 0)).toEqual({ x: 3, y: -GRAVITY });
  },
);
