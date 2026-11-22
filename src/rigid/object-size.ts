import type { EnvironmentSettings } from "./environment";

export interface ObjectSize {
  width: number;
  height: number;
}

export const DEFAULT_OBJECT_SIZE: ObjectSize = { width: 0.5, height: 0.5 };
// Empirical size step in metres: the smallest object and the wall clearance,
// shrunk with the world so a very small world still has room for an object.
export const objectUnit = (
  bounds: Pick<EnvironmentSettings, "width">,
): number => Math.min(0.1, bounds.width / 10);
export const OBJECT_AXES = ["width", "height"] as const;

// Empirical clearance avoids simultaneous contact with opposing walls.
export const maxObjectSize = (
  bounds: Pick<EnvironmentSettings, "width" | "height">,
): ObjectSize => ({
  width: Number((bounds.width - objectUnit(bounds)).toFixed(6)),
  height: Number((bounds.height - objectUnit(bounds)).toFixed(6)),
});

export const fitObjectSize = (
  size: ObjectSize,
  bounds: Pick<EnvironmentSettings, "width" | "height">,
): ObjectSize => {
  const max = maxObjectSize(bounds);
  const min = objectUnit(bounds);
  const scale = Math.min(1, max.width / size.width, max.height / size.height);
  return {
    width: Math.max(min, Math.min(max.width, size.width * scale)),
    height: Math.max(min, Math.min(max.height, size.height * scale)),
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
      size[axis] < objectUnit(bounds) ||
      size[axis] > max[axis]
    )
      throw new Error(`Invalid object size: ${axis}`);
  }
};
