import { expect, it, vi } from "vitest";

import { FrameMeter } from "./frameMeter";

it("reports nothing until a half-second window has passed, then the rate of changed frames", () => {
  const onRate = vi.fn();
  const meter = new FrameMeter(onRate);
  for (let now = 0; now < 500; now += 10) meter.tick(now, true);
  expect(onRate).not.toHaveBeenCalled();
  meter.tick(500, true);
  expect(onRate).toHaveBeenCalledTimes(1);
  expect(onRate.mock.calls[0]?.[0]).toBeCloseTo(100, 5);
});

it("does not count repeats of the same picture, so a 100 Hz display showing 20 pictures a second reads 20", () => {
  const onRate = vi.fn();
  const meter = new FrameMeter(onRate);
  meter.tick(0, false);
  for (let now = 10; now <= 1000; now += 10) meter.tick(now, now % 50 === 0);
  expect(onRate).toHaveBeenLastCalledWith(20);
});

it("starts a fresh window after a restart", () => {
  const onRate = vi.fn();
  const meter = new FrameMeter(onRate);
  for (let now = 0; now < 400; now += 100) meter.tick(now, true);
  meter.restart();
  for (let now = 60_000; now <= 60_500; now += 100) meter.tick(now, true);
  expect(onRate).toHaveBeenCalledTimes(1);
  expect(onRate.mock.calls[0]?.[0]).toBeCloseTo(10, 5);
});
