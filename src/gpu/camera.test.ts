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
