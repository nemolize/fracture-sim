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
    height: 5.1,
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
