import { describe, expect, it } from "vitest";

import { GRAVITY } from "./contact";
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

describe("hasReading", () => {
  it("counts any reading with finite x and y, even a device lying flat", () => {
    expect(hasReading(reading(axes(0, 0, GRAVITY)))).toBe(true);
  });

  it.each([
    ["no reading", null],
    ["a null axis", axes(null, GRAVITY, 0)],
    ["a non-finite axis", axes(Number.NaN, GRAVITY, 0)],
  ])("rejects %s", (_, withGravity) => {
    expect(hasReading(reading(withGravity))).toBe(false);
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

  it("reads a partial tilt, and past sideways an angle beyond a quarter turn", () => {
    const half = GRAVITY / Math.SQRT2;
    expect(
      readMotion(reading(axes(-half, half, 0)), 0, false).tilt,
    ).toBeCloseTo(Math.PI / 4);
    expect(
      readMotion(reading(axes(-half, -half, 0)), 0, false).tilt,
    ).toBeCloseTo((3 * Math.PI) / 4);
  });

  it("follows the screen when it turns", () => {
    // Screen turned 90°: the device's own +y is the screen's left.
    const { tilt } = readMotion(reading(axes(GRAVITY, 0, 0)), 90, false);
    expect(tilt).toBeCloseTo(0);
  });

  it("keeps a shake out of the tilt", () => {
    // An upright device shaken sideways reads the shake on top of gravity's reaction.
    const { tilt, acceleration } = readMotion(
      reading(axes(-20, GRAVITY, 0), axes(-20, 0, 0)),
      0,
      false,
    );
    expect(tilt).toBeCloseTo(0);
    expect(acceleration).toEqual({ x: -20, y: 0 });
  });

  it("undoes the opposite sign some browsers report", () => {
    const { tilt, acceleration } = readMotion(
      reading(axes(1, -GRAVITY - 2, 0), axes(1, -2, 0)),
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
  const tiltOf = (tracker: MotionTracker, now: number): number =>
    Math.asin(tracker.gravity(TUNING, now).x / GRAVITY);

  it("starts with plain gravity straight down", () => {
    const { x, y } = new MotionTracker().gravity(TUNING, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-GRAVITY);
  });

  it("jumps to the first tilt and keeps GRAVITY's strength", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: Math.PI / 6, acceleration: null }, 1000, 0.5);
    const { x, y } = tracker.gravity(TUNING, 1000);
    expect(x).toBeCloseTo(GRAVITY * 0.5);
    expect(Math.hypot(x, y)).toBeCloseTo(GRAVITY);
  });

  it("follows later tilts with the filter's time constant", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: null }, 0, 0.1);
    tracker.update({ tilt: 1, acceleration: null }, 100, 0.1);
    expect(tiltOf(tracker, 100)).toBeCloseTo(1 - Math.exp(-1));
  });

  it("follows at once when the time constant is zero", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: null }, 0, 0);
    tracker.update({ tilt: 1, acceleration: null }, 1, 0);
    expect(tiltOf(tracker, 1)).toBeCloseTo(1);
  });

  it("holds a tilt past sideways at a quarter turn", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: (3 * Math.PI) / 4, acceleration: null }, 0, 0);
    expect(tiltOf(tracker, 0)).toBeCloseTo(Math.PI / 2);
    const other = new MotionTracker();
    other.update({ tilt: -(3 * Math.PI) / 4, acceleration: null }, 0, 0);
    expect(tiltOf(other, 0)).toBeCloseTo(-Math.PI / 2);
  });

  it("stays on its side when noise carries an upside-down tilt across the half turn", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: Math.PI / 2, acceleration: null }, 0, 0);
    tracker.update({ tilt: Math.PI - 0.01, acceleration: null }, 10, 0);
    tracker.update({ tilt: -Math.PI + 0.01, acceleration: null }, 20, 0);
    expect(tiltOf(tracker, 20)).toBeCloseTo(Math.PI / 2);
  });

  it("holds the side of the first upside-down sample when no tilt is held yet", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: -Math.PI + 0.02, acceleration: null }, 0, 0);
    tracker.update({ tilt: Math.PI - 0.02, acceleration: null }, 10, 0);
    tracker.update({ tilt: -Math.PI + 0.03, acceleration: null }, 20, 0);
    expect(tiltOf(tracker, 20)).toBeCloseTo(-Math.PI / 2);
  });

  it("follows a tilt through upside down to the other side once it leaves the noise band", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: Math.PI / 2, acceleration: null }, 0, 0);
    tracker.update({ tilt: -(100 * Math.PI) / 180, acceleration: null }, 10, 0);
    expect(tiltOf(tracker, 10)).toBeCloseTo(-Math.PI / 2);
  });

  it("keeps the side the samples came from, however far a slow filter lags behind", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: -Math.PI / 2, acceleration: null }, 0, 1);
    tracker.update({ tilt: Math.PI / 3, acceleration: null }, 50, 1);
    const before = tiltOf(tracker, 50);
    tracker.update({ tilt: Math.PI - 0.1, acceleration: null }, 100, 1);
    expect(tiltOf(tracker, 100)).toBeGreaterThan(before);
  });

  it("keeps the last tilt when a sample has none", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0.5, acceleration: null }, 0, 0);
    tracker.update({ tilt: null, acceleration: null }, 10, 0);
    expect(tiltOf(tracker, 10)).toBeCloseTo(0.5);
  });

  it("pushes against the device's acceleration, scaled", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: { x: 3, y: -1 } }, 0, 0);
    const { x, y } = tracker.gravity({ inertiaScale: 2, inertiaCap: 100 }, 0);
    expect(x).toBeCloseTo(-6);
    expect(y).toBeCloseTo(-GRAVITY + 2);
  });

  it("caps the push without changing its direction", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: { x: 30, y: 40 } }, 0, 0);
    const { x, y } = tracker.gravity({ inertiaScale: 1, inertiaCap: 5 }, 0);
    expect(x).toBeCloseTo(-3);
    expect(y).toBeCloseTo(-GRAVITY - 4);
  });

  it("drops the push when a sample has no acceleration", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0, acceleration: { x: 3, y: 0 } }, 0, 0);
    tracker.update({ tilt: 0, acceleration: null }, 10, 0);
    expect(tracker.gravity(TUNING, 10).x).toBeCloseTo(0);
  });

  it("stops pushing once events stop arriving, but keeps the tilt", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 0.5, acceleration: { x: 3, y: 0 } }, 0, 0);
    expect(tracker.gravity(TUNING, 500).x).toBeCloseTo(
      GRAVITY * Math.sin(0.5) - 3,
    );
    expect(tracker.gravity(TUNING, 501).x).toBeCloseTo(GRAVITY * Math.sin(0.5));
  });

  it("returns to straight down after a reset", () => {
    const tracker = new MotionTracker();
    tracker.update({ tilt: 1, acceleration: { x: 3, y: 3 } }, 0, 0);
    tracker.reset();
    const { x, y } = tracker.gravity(TUNING, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-GRAVITY);
    tracker.update({ tilt: 1, acceleration: null }, 50, 5);
    expect(tiltOf(tracker, 50)).toBeCloseTo(1);
  });
});
