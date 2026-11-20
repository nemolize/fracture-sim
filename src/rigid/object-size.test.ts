import { expect, it } from "vitest";

import { DEFAULT_ENVIRONMENT } from "./environment";
import {
  DEFAULT_OBJECT_SIZE,
  fitObjectSize,
  maxObjectSize,
  MIN_OBJECT_SIZE,
  OBJECT_AXES,
  validateObjectSize,
} from "./object-size";

it("fits object dimensions to the world without enlarging them", () => {
  expect(fitObjectSize(DEFAULT_OBJECT_SIZE, DEFAULT_ENVIRONMENT)).toEqual({
    width: 2,
    height: 1,
  });
  expect(fitObjectSize({ width: 20, height: 8 }, DEFAULT_ENVIRONMENT)).toEqual({
    width: 9.9,
    height: 3.96,
  });
});

it("accepts minimum, default and maximum-sized boxes", () => {
  for (const size of [
    { width: MIN_OBJECT_SIZE, height: MIN_OBJECT_SIZE },
    DEFAULT_OBJECT_SIZE,
    maxObjectSize(DEFAULT_ENVIRONMENT),
  ])
    expect(() => {
      validateObjectSize(size, DEFAULT_ENVIRONMENT);
    }).not.toThrow();
});

it.each(OBJECT_AXES)("rejects invalid object %s", (axis) => {
  for (const value of [
    NaN,
    Infinity,
    0,
    MIN_OBJECT_SIZE / 2,
    maxObjectSize(DEFAULT_ENVIRONMENT)[axis] + 0.01,
    DEFAULT_ENVIRONMENT[axis] + 0.1,
  ])
    expect(() => {
      validateObjectSize(
        { ...DEFAULT_OBJECT_SIZE, [axis]: value },
        DEFAULT_ENVIRONMENT,
      );
    }).toThrow(`Invalid object size: ${axis}`);
});

it.each([
  { size: { width: 5, height: 5 }, bounds: { width: 10, height: 3 } },
  {
    size: { width: 5, height: (5 * Math.sqrt(3)) / 2 },
    bounds: { width: 10, height: 3.8 },
  },
  {
    size: { width: 5, height: (5 * Math.sqrt(3)) / 2 },
    bounds: { width: 4, height: 20 },
  },
])("keeps aspect ratio when shrinking to $bounds", ({ size, bounds }) => {
  const fitted = fitObjectSize(size, bounds);
  expect(fitted.width / fitted.height).toBeCloseTo(
    size.width / size.height,
    12,
  );
  expect(() => {
    validateObjectSize(fitted, bounds);
  }).not.toThrow();
});
it("retains the minimum dimension when a manually stretched object cannot fit uniformly", () => {
  const fitted = fitObjectSize(
    { width: 29.9, height: 0.1 },
    { width: 4, height: 3 },
  );
  expect(fitted).toEqual({ width: 3.9, height: 0.1 });
  expect(() => {
    validateObjectSize(fitted, { width: 4, height: 3 });
  }).not.toThrow();
});
