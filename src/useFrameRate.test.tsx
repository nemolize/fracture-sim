import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useFrameRate } from "./useFrameRate";

let callbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  callbacks = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const frame = (now: number): void => {
  const pending = callbacks;
  callbacks = [];
  act(() => {
    pending.forEach((callback) => {
      callback(now);
    });
  });
};

it("shows nothing until a half-second window has passed, then the rate", () => {
  const { result } = renderHook(() => useFrameRate());
  expect(result.current).toBeNull();
  for (let now = 0; now <= 400; now += 100) frame(now);
  expect(result.current).toBeNull();
  frame(500);
  expect(result.current).toBeCloseTo(10, 5);
  for (let now = 600; now <= 1000; now += 100) frame(now);
  expect(result.current).toBeCloseTo(10, 5);
});

it("starts a fresh window when the tab becomes visible again", () => {
  const { result } = renderHook(() => useFrameRate());
  for (let now = 0; now <= 500; now += 100) frame(now);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  for (let now = 60_000; now <= 60_500; now += 100) frame(now);
  expect(result.current).toBeCloseTo(10, 5);
});

it("stops requesting frames on unmount", () => {
  const { unmount } = renderHook(() => useFrameRate());
  unmount();
  expect(cancelAnimationFrame).toHaveBeenCalled();
});
