import { WORLD_WIDTH } from "@/sim/scenes";

/** Visible height in metres, so the canvas keeps a fixed 10 : 5.6 world. */
export const VIEW_HEIGHT = 5.6;
/** Distance of the floor below the lowest visible world coordinate, in metres. */
export const FLOOR_MARGIN = 0.4;
/** Cap the backing store on high-DPI displays: past 2x the extra pixels are not visible. */
export const MAX_PIXEL_RATIO = 2;

export interface Point {
  x: number;
  y: number;
}

/** Backing-store size for a canvas of the given CSS width. */
export const canvasSize = (
  cssWidth: number,
  devicePixelRatio: number,
): { width: number; height: number } => {
  const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(
      1,
      Math.round((cssWidth * VIEW_HEIGHT * ratio) / WORLD_WIDTH),
    ),
  };
};

/** Maps a pointer position inside the canvas's CSS box to world metres, y up. */
export const pointerToWorld = (
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): Point => {
  const scale = rect.width / WORLD_WIDTH;
  return {
    x: (clientX - rect.left) / scale,
    y: (rect.height - FLOOR_MARGIN * scale - (clientY - rect.top)) / scale,
  };
};

/** Pixels per metre and the canvas row of the floor line, for a backing store of this size. */
export const viewTransform = (
  pixelWidth: number,
  pixelHeight: number,
): { scale: number; floorPixel: number } => {
  const scale = pixelWidth / WORLD_WIDTH;
  return { scale, floorPixel: pixelHeight - FLOOR_MARGIN * scale };
};
