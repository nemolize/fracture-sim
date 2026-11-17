import { describe, expect, it } from "vitest";

import {
  canvasSize,
  FLOOR_MARGIN,
  MAX_PIXEL_RATIO,
  pointerToWorld,
  VIEW_HEIGHT,
  viewTransform,
} from "./camera";

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

describe("pointerToWorld", () => {
  const rect = { left: 100, top: 50, width: 1000, height: 560 };

  it("maps the bottom-left corner above the floor margin", () => {
    const point = pointerToWorld(rect, 100, 50 + 560);
    expect(point.x).toBe(0);
    expect(point.y).toBeCloseTo(-FLOOR_MARGIN, 12);
  });

  it("maps the floor line to y = 0 and the top edge to the view height", () => {
    expect(pointerToWorld(rect, 600, 50 + 560 - 40).y).toBeCloseTo(0, 12);
    expect(pointerToWorld(rect, 1100, 50).y).toBeCloseTo(
      VIEW_HEIGHT - FLOOR_MARGIN,
      12,
    );
    expect(pointerToWorld(rect, 1100, 50).x).toBe(10);
  });
});

describe("viewTransform", () => {
  it("puts the floor line one margin above the bottom edge", () => {
    expect(viewTransform(1000, 560)).toEqual({ scale: 100, floorPixel: 520 });
  });
});
