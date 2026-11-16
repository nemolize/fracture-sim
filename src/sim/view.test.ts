import { expect, it } from "vitest";

import { heat, pieceColor, shade } from "./view";

it("heat clamps to the ends of the ramp", () => {
  expect(heat(-1)).toBe(heat(0));
  expect(heat(5)).toBe(heat(1));
  expect(heat(0)).toBe("rgb(0 0 160)");
  expect(heat(1)).toBe("rgb(255 255 0)");
});

it("pieceColor is stable and varies by id", () => {
  expect(pieceColor(2)).toBe(pieceColor(2));
  expect(pieceColor(2)).not.toBe(pieceColor(3));
});

it("shade scales channels and caps them at 255", () => {
  expect(shade([100, 200, 50], 0.5)).toBe("rgb(50 100 25)");
  expect(shade([200, 200, 200], 2)).toBe("rgb(255 255 255)");
});
