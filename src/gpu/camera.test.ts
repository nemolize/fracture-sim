import { describe, expect, it } from "vitest";

import {
  canvasSize,
  floorMargin,
  MAX_PIXEL_RATIO,
  visibleWorldHeight,
} from "./camera";

describe("canvasSize", () => {
  it("follows the CSS size", () => {
    expect(canvasSize(1000, 700, 1)).toEqual({ width: 1000, height: 700 });
  });

  it("caps the pixel ratio", () => {
    expect(canvasSize(500, 300, 3)).toEqual(
      canvasSize(500, 300, MAX_PIXEL_RATIO),
    );
    expect(canvasSize(500, 300, 2).width).toBe(1000);
  });

  it("never returns an empty size", () => {
    expect(canvasSize(0, 0, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe("visibleWorldHeight", () => {
  it("follows the canvas aspect ratio at a fixed world width", () => {
    expect(visibleWorldHeight(1000, 900, 10)).toBeCloseTo(8.6);
    expect(visibleWorldHeight(390, 800, 10)).toBeCloseTo(20.1, 1);
  });

  it("scales with the world width and never goes negative", () => {
    expect(visibleWorldHeight(900, 420, 18)).toBeCloseTo(8);
    expect(visibleWorldHeight(1000, 1, 10)).toBe(0);
  });

  it("is empty for an unmeasured canvas", () => {
    expect(visibleWorldHeight(0, 500, 10)).toBe(0);
  });
});

it("maps client coordinates to world metres using the floor margin", async () => {
  const { pointerToWorld } = await import("./camera");
  expect(
    pointerToWorld({ left: 10, top: 20, width: 1000, height: 560 }, 510, 530),
  ).toEqual({ x: 5, y: 0.1 });
});

it("uses the selected world width for pointer metres", async () => {
  const { pointerToWorld } = await import("./camera");
  expect(
    pointerToWorld({ left: 10, top: 20, width: 900, height: 420 }, 660, 170, {
      width: 18,
    }),
  ).toEqual({ x: 13, y: 5 });
});

it("caps tall and wide backing stores at the device limit", () => {
  expect(canvasSize(816, 5000, 2, 8192)).toEqual({ width: 1336, height: 8192 });
  expect(canvasSize(10000, 500, 2, 8192)).toEqual({ width: 8192, height: 409 });
});

it("keeps the floor margin in proportion in small worlds", () => {
  expect(floorMargin(10)).toBe(0.4);
  expect(floorMargin(30)).toBe(0.4);
  expect(floorMargin(0.1)).toBeCloseTo(0.004);
  expect(visibleWorldHeight(1000, 1000, 0.1)).toBeCloseTo(0.096);
});
