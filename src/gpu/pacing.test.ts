import { describe, expect, it } from "vitest";

import {
  MAX_FRAME_SECONDS,
  MAX_SIM_SECONDS_PER_FRAME,
  planFrame,
  SkippedTime,
} from "./pacing";

const DT = 0.0003;

it("runs the steps a frame owes and carries the remainder", () => {
  const first = planFrame(0, 0.01, 0.5, DT);
  expect(first.steps).toBe(16);
  expect(first.capped).toBe(false);
  expect(first.clock).toBeCloseTo(0.005 - 16 * DT, 12);
  const second = planFrame(first.clock, 0.01, 0.5, DT);
  expect(second.steps).toBe(17);
});

it("does not accept a frame longer than the limit", () => {
  const plan = planFrame(0, 10, 0.1, DT);
  expect(plan.steps).toBe(Math.floor((MAX_FRAME_SECONDS * 0.1) / DT));
});

it("cuts a frame that owes more than the cap and drops the backlog", () => {
  const plan = planFrame(0, MAX_FRAME_SECONDS, 1, 0.00005);
  expect(plan).toEqual({
    steps: Math.floor(MAX_SIM_SECONDS_PER_FRAME / 0.00005),
    clock: 0,
    capped: true,
  });
});

it("caps the standard mesh at 120 steps, the cap's simulated time over its step", () => {
  expect(planFrame(0, MAX_FRAME_SECONDS, 1, 0.0003).steps).toBe(120);
});

it.each([0.5, 1])(
  "does not cap speed %s on the finest mesh at 60 frames per second",
  (speed) => {
    expect(planFrame(0, 1 / 60, speed, 0.00009).capped).toBe(false);
  },
);

describe("SkippedTime", () => {
  it("passes a frame's time through when the GPU is idle", () => {
    expect(new SkippedTime().take(0.016, false)).toBe(0.016);
  });

  it("keeps a skipped frame's time and owes it to the next frame that runs", () => {
    const skipped = new SkippedTime();
    expect(skipped.take(0.016, true)).toBeNull();
    expect(skipped.take(0.017, true)).toBeNull();
    expect(skipped.take(0.016, false)).toBeCloseTo(0.049, 12);
    expect(skipped.take(0.016, false)).toBe(0.016);
  });

  it("leaves the clamp on the total to planFrame, so a long stall cannot burst", () => {
    const skipped = new SkippedTime();
    skipped.take(10, true);
    const owed = skipped.take(0.016, false) ?? 0;
    expect(planFrame(0, owed, 0.5, DT).steps).toBe(
      Math.floor((MAX_FRAME_SECONDS * 0.5) / DT),
    );
  });
});
