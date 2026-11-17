import { expect, it } from "vitest";

import { MAX_FRAME_SECONDS, MAX_STEPS_PER_FRAME, planFrame } from "./pacing";

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
    steps: MAX_STEPS_PER_FRAME,
    clock: 0,
    capped: true,
  });
});

it("keeps default speed on the finest mesh under the cap at 60 frames per second", () => {
  const plan = planFrame(0, 1 / 60, 0.5, 0.00009);
  expect(plan.capped).toBe(false);
});
