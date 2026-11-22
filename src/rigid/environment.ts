import { GRAVITY, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";

export interface EnvironmentSettings {
  gravity: number;
  width: number;
  height: number;
}

export const ENVIRONMENT_KEYS = ["gravity", "width", "height"] as const;

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  gravity: GRAVITY,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
};

export const ENVIRONMENT_RANGES = {
  gravity: { min: 0, max: 40, step: 0.1 },
  width: { min: 0.1, max: 30, step: 0.1 },
  height: { min: 0.05, max: 20, step: 0.1 },
} as const;

// Scale limits keep both dimensions inside the empirical world bounds.
export const WORLD_SCALE_RANGE = { min: 0.01, max: 3, step: 0.01 } as const;

export const withWorldScale = (
  settings: EnvironmentSettings,
  scale: number,
): EnvironmentSettings => ({
  ...settings,
  width: Number((WORLD_WIDTH * scale).toFixed(6)),
  height: Number((WORLD_HEIGHT * scale).toFixed(6)),
});

export const DEFAULT_WORLD_SCALE = 0.2;

/** The settings' starting world; DEFAULT_ENVIRONMENT is the ×1 reference. */
export const INITIAL_ENVIRONMENT = withWorldScale(
  DEFAULT_ENVIRONMENT,
  DEFAULT_WORLD_SCALE,
);

export const worldScale = (settings: EnvironmentSettings): number =>
  settings.width / WORLD_WIDTH;

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
