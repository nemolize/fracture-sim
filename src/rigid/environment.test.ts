import { expect, it } from "vitest";

import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENT_KEYS,
  ENVIRONMENT_RANGES,
  validateEnvironment,
  withWorldScale,
  WORLD_SCALE_RANGE,
  worldScale,
} from "./environment";

it("accepts defaults and both ends of every environment bound", () => {
  expect(() => {
    validateEnvironment(DEFAULT_ENVIRONMENT);
  }).not.toThrow();
  for (const key of ENVIRONMENT_KEYS) {
    for (const value of [
      ENVIRONMENT_RANGES[key].min,
      ENVIRONMENT_RANGES[key].max,
    ])
      expect(() => {
        validateEnvironment({ ...DEFAULT_ENVIRONMENT, [key]: value });
      }).not.toThrow();
  }
});

it.each(ENVIRONMENT_KEYS)("rejects invalid %s", (key) => {
  for (const value of [
    NaN,
    Infinity,
    ENVIRONMENT_RANGES[key].min - 0.01,
    ENVIRONMENT_RANGES[key].max + 0.01,
  ])
    expect(() => {
      validateEnvironment({ ...DEFAULT_ENVIRONMENT, [key]: value });
    }).toThrow(`Invalid environment setting: ${key}`);
});

it("applies absolute world scale without changing other physics inputs", () => {
  const source = {
    ...DEFAULT_ENVIRONMENT,
    gravity: 1.6,
    density: 50,
    friction: 0.83,
  };
  const larger = withWorldScale(source, 1.8);
  expect(larger).toEqual({ ...source, width: 18, height: 9.36 });
  expect(worldScale(larger)).toBe(1.8);
  expect(withWorldScale(larger, 1)).toEqual(source);
  expect(source).toEqual({
    ...DEFAULT_ENVIRONMENT,
    gravity: 1.6,
    density: 50,
    friction: 0.83,
  });
});
it("keeps every world scale slider position inside supported bounds", () => {
  const { min, max, step } = WORLD_SCALE_RANGE;
  for (let tick = 0; tick <= Math.round((max - min) / step); tick++) {
    const scale = Number((min + tick * step).toFixed(2));
    const value = withWorldScale(DEFAULT_ENVIRONMENT, scale);
    expect(() => {
      validateEnvironment(value);
    }).not.toThrow();
    expect(value.width / value.height).toBeCloseTo(10 / 5.2, 12);
    expect(worldScale(value)).toBeCloseTo(scale, 12);
  }
});
