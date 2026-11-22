import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentSettings,
} from "@/rigid/environment";

/** Visible floor depth in metres. */
export const FLOOR_MARGIN = 0.4;
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

/** Pixel rectangle the world occupies: full width, anchored to the canvas bottom. */
export const worldViewport = (
  canvas: { width: number; height: number },
  bounds: Pick<EnvironmentSettings, "width" | "height"> = DEFAULT_ENVIRONMENT,
): { x: number; y: number; width: number; height: number } => {
  const height = Math.min(
    canvas.height,
    (canvas.width * (bounds.height + FLOOR_MARGIN)) / bounds.width,
  );
  return { x: 0, y: canvas.height - height, width: canvas.width, height };
};

export const pointerToWorld = (
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  bounds: Pick<EnvironmentSettings, "width"> = DEFAULT_ENVIRONMENT,
): { x: number; y: number } => {
  const scale = rect.width / bounds.width;
  return {
    x: (clientX - rect.left) / scale,
    y: (rect.height - FLOOR_MARGIN * scale - (clientY - rect.top)) / scale,
  };
};
