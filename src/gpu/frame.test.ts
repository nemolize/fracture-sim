import { describe, expect, it } from "vitest";

import {
  BACKGROUND,
  packShapes,
  packView,
  SHAPES_BYTES,
  VIEW_BYTES,
} from "./frame";

describe("packView", () => {
  it("writes the canvas size, the transform, the base colour and the mode id", () => {
    const buffer = packView(1000, 560, "damage", [255, 0, 51]);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);
    expect(buffer.byteLength).toBe(VIEW_BYTES);
    expect(Array.from(f32.slice(0, 4))).toEqual([1000, 560, 100, 520]);
    expect(Array.from(f32.slice(4, 8))).toEqual([1, 0, Math.fround(0.2), 1]);
    expect(u32[8]).toBe(1);
  });
});

describe("packShapes", () => {
  it("covers the floor band below the floor line with one rectangle", () => {
    const floats = packShapes(1000, 560, null);
    expect(floats.byteLength).toBe(SHAPES_BYTES);
    // Floor: from (0, 540) to (1000, 540), half as thick as the 40-pixel band.
    expect(Array.from(floats.slice(0, 4))).toEqual([0, 540, 1000, 540]);
    expect(floats[8]).toBe(20);
  });

  it("collapses the aim line to nothing without an aim", () => {
    expect(packShapes(1000, 560, null)[12 + 8]).toBe(0);
  });

  it("draws the aim line between the two world points in canvas pixels", () => {
    const floats = packShapes(1000, 560, { x0: 1, y0: 2, x1: 3, y1: 4 });
    expect(Array.from(floats.slice(12, 16))).toEqual([100, 320, 300, 120]);
    expect(floats[12 + 8]).toBe(1.5);
  });
});

it("clears to the page background grey", () => {
  expect(BACKGROUND).toEqual([243, 244, 246]);
});
