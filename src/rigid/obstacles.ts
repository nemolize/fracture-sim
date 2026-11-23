import { type Obstacle, ObstacleGrid } from "@/sim/obstacles";

import type { BodyShape } from "./body";

export const bodyObstacles = (shapes: readonly BodyShape[]): Obstacle[] =>
  shapes
    .filter(({ fixed }) => !fixed)
    .map(({ body, polygon }) => {
      const { x, y } = body.translation();
      const angle = body.rotation();
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const ring = polygon.map(([px, py]) => ({
        x: x + px * cos - py * sin,
        y: y + px * sin + py * cos,
      }));
      return {
        centre: { x, y },
        extent: Math.max(...ring.map((v) => Math.hypot(v.x - x, v.y - y))),
        ring,
      };
    });

// Chosen empirically, no fixed source.
const CELLS_ACROSS = 32;

export class BodyObstacles {
  readonly grid: ObstacleGrid;
  private settledAt: number | null = null;

  constructor(width: number, height: number) {
    this.grid = new ObstacleGrid(width / CELLS_ACROSS, width, height);
  }

  refresh(
    shapes: readonly BodyShape[],
    geometryRevision: number,
    needed: boolean,
  ): void {
    if (!needed) {
      this.settledAt = null;
      return;
    }
    const settled = shapes.every(
      ({ body, fixed }) => fixed || body.isSleeping(),
    );
    if (settled && this.settledAt === geometryRevision) return;
    this.grid.rebuild(bodyObstacles(shapes));
    this.settledAt = settled ? geometryRevision : null;
  }
}
