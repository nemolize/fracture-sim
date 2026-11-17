import { describe, expect, it } from "vitest";

import { GRAVITY } from "./contact";
import { type Axes, MotionTracker, readMotion, toScreenFrame } from "./motion";

const axes = (x: number | null, y: number | null, z: number | null): Axes => ({
  x,
  y,
  z,
});

const reading = (
  withGravity: Axes | null,
  acceleration: Axes | null = null,
) => ({ accelerationIncludingGravity: withGravity, acceleration });

const TUNING = { inertiaScale: 1, inertiaCap: 100 };

describe("toScreenFrame", () => {
  it.each([
    [0, { x: 2, y: 3 }],
    [90, { x: -3, y: 2 }],
    [180, { x: -2, y: -3 }],
    [270, { x: 3, y: -2 }],
    [360, { x: 2, y: 3 }],
    [-90, { x: 3, y: -2 }],
  ])("turns a vector for a screen angle of %s", (angle, expected) => {
    expect(toScreenFrame({ x: 2, y: 3 }, angle)).toEqual(expected);
  });
});

describe("readMotion", () => {
  it("reads an upright device as straight down", () => {
    const { tilt } = readMotion(reading(axes(0, GRAVITY, 0)), 0, false);
    expect(tilt).toBeCloseTo(0);
  });

  it("tilts toward the side the device leans to", () => {
    // Right edge down: gravity points along the device's +x, so the reading is -x.
    const right = readMotion(reading(axes(-GRAVITY, 0, 0)), 0, false);
    expect(right.tilt).toBeCloseTo(Math.PI / 2);
    const left = readMotion(reading(axes(GRAVITY, 0, 0)), 0, false);
    expect(left.tilt).toBeCloseTo(-Math.PI / 2);
  });

  it("reads a partial tilt as its angle", () => {
    const half = GRAVITY / Math.SQRT2;
    const { tilt } = readMotion(reading(axes(-half, half, 0)), 0, false);
    expect(tilt).toBeCloseTo(Math.PI / 4);
  });

  it("holds a device tilted past sideways at a quarter turn", () => {
    const half = GRAVITY / Math.SQRT2;
    const over = readMotion(reading(axes(-half, -half, 0)), 0, false);
    expect(over.tilt).toBeCloseTo(Math.PI / 2);
    const other = readMotion(reading(axes(half, -half, 0)), 0, false);
    expect(other.tilt).toBeCloseTo(-Math.PI / 2);
  });

  it("follows the screen when it turns", () => {
    // Screen turned 90°: the device's own +y is the screen's left.
    const { tilt } = readMotion(reading(axes(GRAVITY, 0, 0)), 90, false);
    expect(tilt).toBeCloseTo(0);
  });

  it("undoes the opposite sign some browsers report", () => {
    const { tilt, acceleration } = readMotion(
      reading(axes(0, -GRAVITY, 0), axes(1, -2, 0)),
      0,
      true,
    );
    expect(tilt).toBeCloseTo(0);
    expect(acceleration).toEqual({ x: -1, y: 2 });
  });

  it("gives no tilt for a device lying flat", () => {
    expect(
      readMotion(reading(axes(0.3, 0.2, GRAVITY)), 0, false).tilt,
    ).toBeNull();
  });

  it.each([
    ["no reading", null],
    ["a null axis", axes(null, GRAVITY, 0)],
    ["a missing y", axes(0, null, 0)],
    ["a non-finite axis", axes(Number.NaN, GRAVITY, 0)],
  ])("gives no tilt for %s", (_, withGravity) => {
    expect(readMotion(reading(withGravity), 0, false).tilt).toBeNull();
  });

  it("reads the acceleration in the screen frame, or none when it is unusable", () => {
    const turned = readMotion(reading(null, axes(1, 2, 0)), 90, false);
    expect(turned.acceleration).toEqual({ x: -2, y: 1 });
    expect(readMotion(reading(null, null), 0, false).acceleration).toBeNull();
    expect(
      readMotion(reading(null, axes(null, null, null)), 0, false).acceleration,
    ).toBeNull();
  });
});

describe("MotionTracker", () => {
  it("starts with plain gravity straight down", () => {
    const { x, y } = new MotionTracker().gravity(TUNING);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-GRAVITY);
  });

  it("jumps to the first tilt and keeps GRAVITY's strength", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: Math.PI / 6, acceleration: null }, 1000, 0.5);
    const { x, y } = tracker.gravity(TUNING);
    expect(x).toBeCloseTo(GRAVITY * 0.5);
    expect(Math.hypot(x, y)).toBeCloseTo(GRAVITY);
  });

  it("follows later tilts with the filter's time constant", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: null }, 0, 0.1);
    tracker.update({ tilt: 1, acceleration: null }, 100, 0.1);
    const moved = Math.asin(tracker.gravity(TUNING).x / GRAVITY);
    expect(moved).toBeCloseTo(1 - Math.exp(-1));
  });

  it("follows at once when the time constant is zero", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: null }, 0, 0);
    tracker.update({ tilt: 1, acceleration: null }, 1, 0);
    expect(Math.asin(tracker.gravity(TUNING).x / GRAVITY)).toBeCloseTo(1);
  });

  it("keeps the last tilt when a sample has none", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0.5, acceleration: null }, 0, 0);
    tracker.update({ tilt: null, acceleration: null }, 10, 0);
    expect(Math.asin(tracker.gravity(TUNING).x / GRAVITY)).toBeCloseTo(0.5);
  });

  it("pushes against the device's acceleration, scaled", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: { x: 3, y: -1 } }, 0, 0);
    const { x, y } = tracker.gravity({ inertiaScale: 2, inertiaCap: 100 });
    expect(x).toBeCloseTo(-6);
    expect(y).toBeCloseTo(-GRAVITY + 2);
  });

  it("caps the push without changing its direction", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: { x: 30, y: 40 } }, 0, 0);
    const { x, y } = tracker.gravity({ inertiaScale: 1, inertiaCap: 5 });
    expect(x).toBeCloseTo(-3);
    expect(y).toBeCloseTo(-GRAVITY - 4);
  });

  it("drops the push when a sample has no acceleration", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: { x: 3, y: 0 } }, 0, 0);
    tracker.update({ tilt: 0, acceleration: null }, 10, 0);
    expect(tracker.gravity(TUNING).x).toBeCloseTo(0);
  });

  it("returns to straight down after a reset", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 1, acceleration: { x: 3, y: 3 } }, 0, 0);
    tracker.reset();
    const { x, y } = tracker.gravity(TUNING);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-GRAVITY);
    tracker.update({ tilt: 1, acceleration: null }, 50, 5);
    expect(Math.asin(tracker.gravity(TUNING).x / GRAVITY)).toBeCloseTo(1);
  });
});
