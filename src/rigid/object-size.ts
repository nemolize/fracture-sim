import type { EnvironmentSettings } from "./environment";

export interface ObjectSize {
  width: number;
  height: number;
}

export const DEFAULT_OBJECT_SIZE: ObjectSize = { width: 2, height: 1 };
// Empirical lower bound for the initial object controls, in metres.
export const MIN_OBJECT_SIZE = 0.1;
export const OBJECT_AXES = ["width", "height"] as const;

// Empirical clearance avoids simultaneous contact with opposing walls.
export const maxObjectSize = (
  bounds: Pick<EnvironmentSettings, "width" | "height">,
): ObjectSize => ({
  width: Number((bounds.width - 0.1).toFixed(1)),
  height: Number((bounds.height - 0.1).toFixed(1)),
});

export const fitObjectSize = (
  size: ObjectSize,
  bounds: Pick<EnvironmentSettings, "width" | "height">,
): ObjectSize => {
  const max = maxObjectSize(bounds);
  const scale = Math.min(1, max.width / size.width, max.height / size.height);
  return {
    width: Math.max(MIN_OBJECT_SIZE, Math.min(max.width, size.width * scale)),
    height: Math.max(
      MIN_OBJECT_SIZE,
      Math.min(max.height, size.height * scale),
    ),
  };
};

export const validateObjectSize = (
  size: ObjectSize,
  bounds: Pick<EnvironmentSettings, "width" | "height">,
): void => {
  const max = maxObjectSize(bounds);
  for (const axis of OBJECT_AXES) {
    if (
      !Number.isFinite(size[axis]) ||
      size[axis] < MIN_OBJECT_SIZE ||
      size[axis] > max[axis]
    )
      throw new Error(`Invalid object size: ${axis}`);
  }
};
