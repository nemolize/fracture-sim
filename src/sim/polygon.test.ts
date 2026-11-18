import { describe, expect, it } from "vitest";

import {
  normalizeConvex,
  polygonMoments,
  removeNoiseVertices,
} from "./polygon";

describe("polygon normalization", () => {
  it("removes consecutive clipping duplicates and collinear noise", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const withNoise = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(removeNoiseVertices(withNoise, 1)).toEqual(square);
  });
  it("rejects collinear backtracking instead of silently removing it", () => {
    expect(() =>
      normalizeConvex([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
        { x: 0, y: 3 },
      ]),
    ).toThrow();
  });
  it("rejects overflowed area", () => {
    expect(() =>
      normalizeConvex([
        { x: 0, y: 0 },
        { x: 1e200, y: 0 },
        { x: 0, y: 1e200 },
      ]),
    ).toThrow("no area");
  });
});

it("calculates representable large moments and rejects unrepresentable results", () => {
  const square = (side: number) => [
    { x: 0, y: 0 },
    { x: side, y: 0 },
    { x: side, y: side },
    { x: 0, y: side },
  ];
  const side = 1e77;
  const expected = ((side * side) / 6) * (side * side);
  expect(
    Math.abs(polygonMoments(square(side)).polarAreaMoment - expected) /
      expected,
  ).toBeLessThan(1e-14);
  expect(() => polygonMoments(square(1e78))).toThrow("unrepresentable");
  expect(() => polygonMoments(square(1e-100))).toThrow("unrepresentable");
});
