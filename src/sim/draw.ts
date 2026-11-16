import { at, atByte, atInt } from "./array";
import { type Ball } from "./contact";
import { WORLD_WIDTH } from "./scenes";
import {
  heat,
  pieceColor,
  PLASTIC_FULL_SCALE,
  shade,
  type ViewMode,
} from "./view";
import type { World } from "./world";

/** Visible height in metres, so the canvas keeps a fixed 10 : 5.6 world. */
export const VIEW_HEIGHT = 5.6;

/** The slice of the 2D context the renderer uses, so tests can supply a plain object. */
export type DrawContext = Pick<
  CanvasRenderingContext2D,
  | "arc"
  | "beginPath"
  | "closePath"
  | "fill"
  | "fillRect"
  | "fillStyle"
  | "lineJoin"
  | "lineTo"
  | "lineWidth"
  | "moveTo"
  | "setTransform"
  | "stroke"
  | "strokeStyle"
>;

export interface Overlay {
  /** Pending throw: from the press point to the pointer, in world coordinates. */
  aim: { x0: number; y0: number; x1: number; y1: number } | null;
}

const triangleColor = (world: World, e: number, view: ViewMode): string => {
  switch (view) {
    case "damage":
      return heat(at(world.damage, e));
    case "plastic":
      return heat(at(world.plasticStrain, e) / PLASTIC_FULL_SCALE);
    case "stress":
      return heat(at(world.stressRatio, e));
    case "chunks":
      return pieceColor(atInt(world.chunkOf, e));
    case "material": {
      // Darken with damage so cracks read before the triangles disappear.
      const brightness = 1 - 0.55 * at(world.damage, e);
      return shade(world.material.color, brightness);
    }
  }
};

const drawBall = (ctx: DrawContext, ball: Ball, scale: number): void => {
  ctx.beginPath();
  ctx.arc(ball.x * scale, -ball.y * scale, ball.radius * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#1f2937";
  ctx.fill();
};

/** Draws the world with y up: the context is flipped so +y points up the screen. */
export const drawWorld = (
  ctx: DrawContext,
  world: World,
  view: ViewMode,
  pixelWidth: number,
  pixelHeight: number,
  overlay: Overlay,
): void => {
  const scale = pixelWidth / WORLD_WIDTH;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  // World origin at the bottom-left of the view, a little above the canvas edge for the floor.
  const floorPixel = pixelHeight - 0.4 * scale;
  ctx.setTransform(1, 0, 0, 1, 0, floorPixel);
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight - floorPixel);

  ctx.lineWidth = 0.6;
  ctx.lineJoin = "round";
  for (let e = 0; e < world.triCount; e++) {
    if (atByte(world.alive, e) === 0) continue;
    const color = triangleColor(world, e, view);
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const n = atInt(world.tri, 3 * e + k);
      const px = at(world.x, n) * scale;
      const py = -at(world.y, n) * scale;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.fill();
    ctx.stroke();
  }

  for (const ball of world.balls) drawBall(ctx, ball, scale);

  const { aim } = overlay;
  if (aim !== null) {
    ctx.beginPath();
    ctx.moveTo(aim.x0 * scale, -aim.y0 * scale);
    ctx.lineTo(aim.x1 * scale, -aim.y1 * scale);
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
};
