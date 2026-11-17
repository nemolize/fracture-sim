import { viewId, type ViewMode } from "@/sim/view";

import { viewTransform } from "./camera";

/** Pending throw: from the press point to the pointer, in world coordinates. */
export interface Aim {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Rgb = readonly [number, number, number];

export const BACKGROUND: Rgb = [243, 244, 246];
const FLOOR: Rgb = [209, 213, 219];
const AIM: Rgb = [220, 38, 38];
const AIM_WIDTH = 3;

/** The `View` uniform of `render.wgsl`, 48 bytes. */
export const VIEW_BYTES = 48;
/** Two `Shape` records (floor, aim line) of 48 bytes each. */
export const SHAPES_BYTES = 96;

export const packView = (
  pixelWidth: number,
  pixelHeight: number,
  view: ViewMode,
  baseColor: Rgb,
): ArrayBuffer => {
  const { scale, floorPixel } = viewTransform(pixelWidth, pixelHeight);
  const buffer = new ArrayBuffer(VIEW_BYTES);
  const floats = new Float32Array(buffer);
  floats.set([pixelWidth, pixelHeight, scale, floorPixel]);
  floats.set(
    baseColor.map((channel) => channel / 255),
    4,
  );
  floats[7] = 1;
  new Uint32Array(buffer)[8] = viewId(view);
  return buffer;
};

const shape = (
  a: readonly [number, number],
  b: readonly [number, number],
  color: Rgb,
  halfWidth: number,
): number[] => [
  ...a,
  ...b,
  ...color.map((channel) => channel / 255),
  1,
  halfWidth,
  0,
  0,
  0,
];

/** The floor band and the aim line as rectangles in canvas pixels; no aim collapses the line to nothing. */
export const packShapes = (
  pixelWidth: number,
  pixelHeight: number,
  aim: Aim | null,
): Float32Array => {
  const { scale, floorPixel } = viewTransform(pixelWidth, pixelHeight);
  const bandHalf = (pixelHeight - floorPixel) / 2;
  const floorMiddle = floorPixel + bandHalf;
  const toPixel = (x: number, y: number): [number, number] => [
    x * scale,
    floorPixel - y * scale,
  ];
  const from = aim === null ? ([0, 0] as const) : toPixel(aim.x0, aim.y0);
  const to = aim === null ? ([0, 0] as const) : toPixel(aim.x1, aim.y1);
  return Float32Array.from([
    ...shape([0, floorMiddle], [pixelWidth, floorMiddle], FLOOR, bandHalf),
    ...shape(from, to, AIM, aim === null ? 0 : AIM_WIDTH / 2),
  ]);
};
