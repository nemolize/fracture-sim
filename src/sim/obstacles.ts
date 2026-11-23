/* eslint-disable @typescript-eslint/no-non-null-assertion -- Cell and plane indices are bounded by construction. */
import type { Vec2 } from "./vec2";

export interface Obstacle {
  centre: Vec2;
  /** Distance from `centre` to the farthest vertex. */
  extent: number;
  /** Convex, counter-clockwise, in world coordinates. */
  ring: readonly Vec2[];
}

export interface Hit {
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** Share of the move completed at the contact; 1 when it started overlapping and was pushed out. */
  fraction: number;
}

// nx, ny, offset along the normal, and the extent of an axis-aligned unit half-square along it.
const PLANE = 4;
// Chosen empirically, no fixed source.
const SKIN_PER_WIDTH = 1e-6;

interface Entry {
  planes: number[];
  stamp: number;
}

const planesOf = ({ ring }: Obstacle): number[] => {
  const planes: number[] = [];
  const add = (nx: number, ny: number, offset: number) => {
    planes.push(nx, ny, offset, Math.abs(nx) + Math.abs(ny));
  };
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = (b.y - a.y) / length;
    const ny = (a.x - b.x) / length;
    add(nx, ny, nx * a.x + ny * a.y);
  }
  // The box around the body completes the sum of the body and an axis-aligned square.
  add(1, 0, Math.max(...ring.map((v) => v.x)));
  add(-1, 0, -Math.min(...ring.map((v) => v.x)));
  add(0, 1, Math.max(...ring.map((v) => v.y)));
  add(0, -1, -Math.min(...ring.map((v) => v.y)));
  return planes;
};

export class ObstacleGrid {
  private readonly cell: number;
  private readonly columns: number;
  private readonly rows: number;
  private readonly cells: Entry[][];
  private stamp = 0;
  // Contacts are returned this far off the surface, above the float32 rounding of a stored position.
  private readonly skin: number;

  constructor(cell: number, width: number, height: number) {
    this.cell = cell;
    this.columns = Math.max(1, Math.ceil(width / cell));
    this.rows = Math.max(1, Math.ceil(height / cell));
    this.skin = width * SKIN_PER_WIDTH;
    this.cells = Array.from({ length: this.columns * this.rows }, () => []);
  }

  rebuild(obstacles: readonly Obstacle[]): void {
    for (const cell of this.cells) cell.length = 0;
    for (const obstacle of obstacles) {
      const entry: Entry = { planes: planesOf(obstacle), stamp: 0 };
      // One cell of margin lets a square centred in a neighbouring cell still find it.
      const reach = obstacle.extent + this.cell;
      const [c0, c1] = this.span(
        obstacle.centre.x - reach,
        obstacle.centre.x + reach,
        this.columns,
      );
      const [r0, r1] = this.span(
        obstacle.centre.y - reach,
        obstacle.centre.y + reach,
        this.rows,
      );
      for (let c = c0; c <= c1; c++)
        for (let r = r0; r <= r1; r++)
          this.cells[c * this.rows + r]!.push(entry);
    }
  }

  /**
   * The first body a square of half-width `half` touches as its centre moves, stopping on the
   * face it came through however thin the body; or the push-out of one it already overlaps.
   * Half-widths beyond one cell are cut to it, which the grid's reach assumes.
   */
  sweep(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    half: number,
  ): Hit | null {
    const reach = Math.min(half, this.cell);
    const [c0, c1] = this.span(
      Math.min(fromX, toX),
      Math.max(fromX, toX),
      this.columns,
    );
    const [r0, r1] = this.span(
      Math.min(fromY, toY),
      Math.max(fromY, toY),
      this.rows,
    );
    this.stamp++;
    let best: Hit | null = null;
    for (let c = c0; c <= c1; c++)
      for (let r = r0; r <= r1; r++)
        for (const entry of this.cells[c * this.rows + r]!) {
          if (entry.stamp === this.stamp) continue;
          entry.stamp = this.stamp;
          const hit = sweepBody(
            entry.planes,
            fromX,
            fromY,
            toX,
            toY,
            reach,
            this.skin,
          );
          if (hit === null) continue;
          // A body entered on the way (fraction < 1) comes before one it merely overlaps.
          if (best === null || hit.fraction < best.fraction) best = hit;
        }
    return best;
  }

  private index(value: number, count: number): number {
    return Math.min(count - 1, Math.max(0, Math.floor(value / this.cell)));
  }

  private span(low: number, high: number, count: number): [number, number] {
    return [this.index(low, count), this.index(high, count)];
  }
}

const sweepBody = (
  planes: readonly number[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  half: number,
  skin: number,
): Hit | null => {
  let enter = 0;
  let exit = 1;
  let nx = 0;
  let ny = 0;
  let entered = false;
  let shallowest = -Infinity;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < planes.length; i += PLANE) {
    const px = planes[i]!;
    const py = planes[i + 1]!;
    const limit = planes[i + 2]! + half * planes[i + 3]!;
    const a = px * fromX + py * fromY - limit;
    const b = px * toX + py * toY - limit;
    if (b > shallowest) {
      shallowest = b;
      sx = px;
      sy = py;
    }
    if (a >= 0) {
      if (b >= 0) return null;
      const t = a / (a - b);
      if (!entered || t > enter) {
        enter = t;
        nx = px;
        ny = py;
        entered = true;
      }
    } else if (b > 0) {
      exit = Math.min(exit, a / (a - b));
    }
  }
  if (enter >= exit) return null;
  if (entered) {
    return {
      x: fromX + (toX - fromX) * enter + nx * skin,
      y: fromY + (toY - fromY) * enter + ny * skin,
      nx,
      ny,
      fraction: enter,
    };
  }
  // Started inside every plane: out through the one the end point is closest to leaving by.
  if (shallowest > 0) return null;
  return {
    x: toX - sx * (shallowest - skin),
    y: toY - sy * (shallowest - skin),
    nx: sx,
    ny: sy,
    fraction: 1,
  };
};
