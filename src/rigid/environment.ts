import { GLASS_DENSITY, GRAVITY, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";

export interface EnvironmentSettings {
  gravity: number;
  width: number;
  height: number;
  density: number;
  friction: number;
}

export const ENVIRONMENT_KEYS = [
  "gravity",
  "width",
  "height",
  "density",
  "friction",
] as const;

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  gravity: GRAVITY,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  density: GLASS_DENSITY,
  friction: 0.5,
};

// Empirical UI bounds; density is mass per area for the 2D bodies.
export const ENVIRONMENT_RANGES = {
  gravity: { min: 0, max: 40, step: 0.1 },
  width: { min: 4, max: 30, step: 0.1 },
  height: { min: 3, max: 20, step: 0.1 },
  density: { min: 1, max: 100, step: 1 },
  friction: { min: 0, max: 2, step: 0.01 },
} as const;

export const validateEnvironment = (settings: EnvironmentSettings): void => {
  for (const key of ENVIRONMENT_KEYS) {
    const { min, max } = ENVIRONMENT_RANGES[key];
    if (
      !Number.isFinite(settings[key]) ||
      settings[key] < min ||
      settings[key] > max
    )
      throw new Error(`Invalid environment setting: ${key}`);
  }
};
