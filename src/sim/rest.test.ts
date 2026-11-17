import { expect, it } from "vitest";

import { restShape } from "./rest";

it("inverts the edge matrix and measures the area of a right triangle", () => {
  const { inverse, area } = restShape({
    x: Float64Array.of(0, 2, 0),
    y: Float64Array.of(0, 0, 4),
    tri: Int32Array.of(0, 1, 2),
  });
  expect(inverse[0]).toBe(0.5);
  expect(inverse[1]).toBeCloseTo(0, 15);
  expect(inverse[2]).toBeCloseTo(0, 15);
  expect(inverse[3]).toBe(0.25);
  expect(Array.from(area)).toEqual([4]);
});
