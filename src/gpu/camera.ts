import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentSettings,
} from "@/rigid/environment";

/** Visible floor depth in metres: 0.4 m in a 10 m world, in proportion below that. */
export const floorMargin = (worldWidth: number): number =>
  Math.min(0.4, worldWidth * 0.04);
/** Cap the backing store on high-DPI displays: past 2x the extra pixels are not visible. */
export const MAX_PIXEL_RATIO = 2;

/** Backing-store size for a canvas of the given CSS size. */
export const canvasSize = (
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maxDimension = Infinity,
): { width: number; height: number } => {
  const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
  const width = Math.max(1, Math.round(cssWidth * ratio));
  const height = Math.max(1, Math.round(cssHeight * ratio));
  const scale = Math.min(1, maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
};

export const visibleWorldHeight = (
  cssWidth: number,
  cssHeight: number,
  worldWidth: number,
): number =>
  cssWidth > 0
    ? Math.max(0, (cssHeight / cssWidth) * worldWidth - floorMargin(worldWidth))
    : 0;

export const pointerToWorld = (
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  bounds: Pick<EnvironmentSettings, "width"> = DEFAULT_ENVIRONMENT,
): { x: number; y: number } => {
  const scale = rect.width / bounds.width;
  return {
    x: (clientX - rect.left) / scale,
    y:
      (rect.height - floorMargin(bounds.width) * scale - (clientY - rect.top)) /
      scale,
  };
};
