import { expect, it } from "vitest";

import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENT_KEYS,
  ENVIRONMENT_RANGES,
  validateEnvironment,
} from "./environment";

it("accepts defaults and both ends of every slider", () => {
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
