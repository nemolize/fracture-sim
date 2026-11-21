import { describe, expect, it } from "vitest";

import { canvasSize, MAX_PIXEL_RATIO } from "./camera";

describe("canvasSize", () => {
  it("keeps the 10 : 5.6 aspect ratio", () => {
    expect(canvasSize(1000, 1)).toEqual({ width: 1000, height: 560 });
  });

  it("caps the pixel ratio", () => {
    expect(canvasSize(500, 3)).toEqual(canvasSize(500, MAX_PIXEL_RATIO));
    expect(canvasSize(500, 2).width).toBe(1000);
  });

  it("never returns an empty size", () => {
    expect(canvasSize(0, 1)).toEqual({ width: 1, height: 1 });
  });
});

it("maps client coordinates to world metres using the floor margin", async () => {
  const { pointerToWorld } = await import("./camera");
  expect(
    pointerToWorld({ left: 10, top: 20, width: 1000, height: 560 }, 510, 530),
  ).toEqual({ x: 5, y: 0.1 });
});

it("uses the selected world dimensions for backing size and pointer metres", async () => {
  const { pointerToWorld } = await import("./camera");
  expect(canvasSize(900, 1, { width: 18, height: 8 })).toEqual({
    width: 900,
    height: 420,
  });
  expect(
    pointerToWorld({ left: 10, top: 20, width: 900, height: 420 }, 660, 170, {
      width: 18,
    }),
  ).toEqual({ x: 13, y: 5 });
});

it("caps tall and wide backing stores at the device limit without changing aspect ratio", () => {
  const tall = canvasSize(816, 2, { width: 4, height: 20 }, 8192);
  expect(tall.height).toBe(8192);
  expect(tall.width / tall.height).toBeCloseTo(4 / 20.4, 3);
  const wide = canvasSize(10000, 2, { width: 30, height: 3 }, 8192);
  expect(wide.width).toBe(8192);
  expect(wide.height / wide.width).toBeCloseTo(3.4 / 30, 3);
  expect(canvasSize(0, 2, { width: 4, height: 20 }, 8192)).toEqual({
    width: 1,
    height: 1,
  });
});
