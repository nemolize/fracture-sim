/* eslint-disable @typescript-eslint/no-non-null-assertion -- Indices stay inside the preallocated buffer. */
import type { ObstacleGrid } from "./obstacles";
import type { Vec2 } from "./vec2";

// Chosen empirically, no fixed source.
export const MAX_PARTICLES = 4000;
const SURFACE_FRICTION = 0.9;
// Chosen empirically, no fixed source.
const MAX_LANDINGS = 3;

const X = 0;
const VX = 2;
const SIZE = 4;
const STRIDE = 5;

export interface Bounds {
  width: number;
  height: number;
}

/** Ballistic squares that stay where they settle and never push bodies. */
export class ParticleField {
  private readonly data = new Float32Array(MAX_PARTICLES * STRIDE);
  private count = 0;
  private next = 0;

  get size(): number {
    return this.count;
  }

  /** At capacity the oldest particle is replaced. */
  spawn(position: Vec2, velocity: Vec2, size: number): void {
    const slot = this.next;
    this.next = (this.next + 1) % MAX_PARTICLES;
    this.count = Math.min(this.count + 1, MAX_PARTICLES);
    this.data.set(
      [position.x, position.y, velocity.x, velocity.y, size],
      slot * STRIDE,
    );
  }

  step(
    seconds: number,
    gravity: Vec2,
    bounds: Bounds,
    obstacles?: ObstacleGrid,
  ): void {
    const d = this.data;
    for (let i = 0; i < this.count; i++) {
      const o = i * STRIDE;
      d[o + VX] = d[o + VX]! + gravity.x * seconds;
      d[o + VX + 1] = d[o + VX + 1]! + gravity.y * seconds;
      const fromX = d[o + X]!;
      const fromY = d[o + X + 1]!;
      d[o + X] = fromX + d[o + VX]! * seconds;
      d[o + X + 1] = fromY + d[o + VX + 1]! * seconds;
      if (obstacles !== undefined)
        this.landOnBodies(o, obstacles, fromX, fromY);
      this.contain(o, 0, bounds.width);
      this.contain(o, 1, bounds.height);
    }
  }

  snapshot(): Float32Array<ArrayBuffer> {
    const out = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      const o = i * STRIDE;
      out.set(
        [this.data[o + X]!, this.data[o + X + 1]!, this.data[o + SIZE]!],
        i * 3,
      );
    }
    return out;
  }

  /**
   * Stops particle `o` against the first body on its way from (`fromX`, `fromY`), slides the rest
   * of the move along it, and does the same for any body the slide meets.
   */
  private landOnBodies(
    o: number,
    obstacles: ObstacleGrid,
    fromX: number,
    fromY: number,
  ): void {
    const d = this.data;
    const half = this.drawnHalf(o);
    let startX = fromX;
    let startY = fromY;
    let endX = d[o + X]!;
    let endY = d[o + X + 1]!;
    let slowed = false;
    for (let landing = 0; landing < MAX_LANDINGS; landing++) {
      const hit = obstacles.sweep(startX, startY, endX, endY, half);
      if (hit === null) break;
      const left = 1 - hit.fraction;
      const restX = (endX - startX) * left;
      const restY = (endY - startY) * left;
      const into = restX * hit.nx + restY * hit.ny;
      startX = hit.x;
      startY = hit.y;
      endX = hit.x + restX - into * hit.nx;
      endY = hit.y + restY - into * hit.ny;
      const inward = d[o + VX]! * hit.nx + d[o + VX + 1]! * hit.ny;
      if (inward < 0) {
        d[o + VX] = d[o + VX]! - inward * hit.nx;
        d[o + VX + 1] = d[o + VX + 1]! - inward * hit.ny;
        slowed = true;
      }
    }
    d[o + X] = endX;
    d[o + X + 1] = endY;
    if (slowed) {
      d[o + VX] = d[o + VX]! * SURFACE_FRICTION;
      d[o + VX + 1] = d[o + VX + 1]! * SURFACE_FRICTION;
    }
  }

  private drawnHalf(o: number): number {
    return this.data[o + SIZE]! / 2;
  }

  private contain(o: number, axis: 0 | 1, limit: number): void {
    const d = this.data;
    const half = this.drawnHalf(o);
    const clamped = Math.fround(
      Math.min(limit - half, Math.max(half, d[o + X + axis]!)),
    );
    // Compared as float32: a resting particle's stored position is already rounded.
    if (clamped === d[o + X + axis]) return;
    d[o + X + axis] = clamped;
    d[o + VX + axis] = 0;
    d[o + VX + 1 - axis] = d[o + VX + 1 - axis]! * SURFACE_FRICTION;
  }
}
