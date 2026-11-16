import { describe, expect, it } from "vitest";

import { svd2 } from "./svd";

const out = new Float64Array(6);

/** Rebuilds U diag(s1, s2) V^T from the packed result. */
const rebuild = (): number[] => {
  const [cu = 0, su = 0, cv = 0, sv = 0, s1 = 0, s2 = 0] = out;
  return [
    s1 * cu * cv + s2 * su * sv,
    s1 * cu * sv - s2 * su * cv,
    s1 * su * cv - s2 * cu * sv,
    s1 * su * sv + s2 * cu * cv,
  ];
};

describe("svd2", () => {
  it.each([
    [1, 0, 0, 1],
    [2, 0.5, -0.3, 1.2],
    [0, -1, 1, 0],
    [3, 1, 1, -2],
    [-1, 0, 0, -1],
    [0.4, 2, 0.1, -0.7],
    [1, 0, 0, -1],
    [0, 0, 0, 0],
    [0.5, 0, 0, 2],
  ])("reconstructs [%f %f; %f %f] with ordered stretches", (a, b, c, d) => {
    svd2(a, b, c, d, out);
    const rebuilt = rebuild();
    [a, b, c, d].forEach((value, i) => {
      expect(rebuilt[i]).toBeCloseTo(value, 9);
    });
    expect(out[4]).toBeGreaterThanOrEqual(out[5] ?? 0);
  });

  it("reports a negative second stretch for an inverted element", () => {
    svd2(1, 0, 0, -1, out);
    expect(out[5]).toBeLessThan(0);
  });

  it("returns unit rotations", () => {
    svd2(2, 0.5, -0.3, 1.2, out);
    expect(Math.hypot(out[0] ?? 0, out[1] ?? 0)).toBeCloseTo(1, 12);
    expect(Math.hypot(out[2] ?? 0, out[3] ?? 0)).toBeCloseTo(1, 12);
  });
});
