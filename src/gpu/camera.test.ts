import { describe, expect, it } from "vitest";

import { canvasSize, MAX_PIXEL_RATIO, worldViewport } from "./camera";

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

describe("worldViewport", () => {
  it("anchors the full-width world to the bottom of a taller canvas", () => {
    const view = worldViewport({ width: 1000, height: 900 });
    expect(view.y).toBeCloseTo(340);
    expect(view).toMatchObject({ x: 0, width: 1000 });
    expect(view.height).toBeCloseTo(560);
  });

  it("uses the selected world dimensions", () => {
    expect(
      worldViewport({ width: 900, height: 420 }, { width: 18, height: 8 }),
    ).toEqual({ x: 0, y: 0, width: 900, height: 420 });
  });

  it("never exceeds the canvas height", () => {
    expect(worldViewport({ width: 1000, height: 300 }).height).toBe(300);
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
