/* eslint-disable @typescript-eslint/no-non-null-assertion -- Indices stay inside the preallocated buffer. */
import type { Vec2 } from "./vec2";

// Chosen empirically, no fixed source.
export const MAX_PARTICLES = 4000;
export const PARTICLE_LIFETIME = 2;
const WALL_FRICTION = 0.9;

const X = 0;
const VX = 2;
const SIZE = 4;
const AGE = 5;
const STRIDE = 6;

export interface Bounds {
  width: number;
  height: number;
}

/** Ballistic squares confined to the container; they never collide with bodies. */
export class ParticleField {
  private readonly data = new Float32Array(MAX_PARTICLES * STRIDE);
  private count = 0;

  get size(): number {
    return this.count;
  }

  /** At capacity the oldest particle is replaced. */
  spawn(position: Vec2, velocity: Vec2, size: number): void {
    const slot = this.count < MAX_PARTICLES ? this.count++ : this.oldest();
    this.data.set(
      [position.x, position.y, velocity.x, velocity.y, size, 0],
      slot * STRIDE,
    );
  }

  step(seconds: number, gravity: Vec2, bounds: Bounds): void {
    const d = this.data;
    for (let i = 0; i < this.count;) {
      const o = i * STRIDE;
      d[o + AGE] = d[o + AGE]! + seconds;
      if (d[o + AGE]! >= PARTICLE_LIFETIME) {
        this.count--;
        d.copyWithin(o, this.count * STRIDE, (this.count + 1) * STRIDE);
        continue;
      }
      d[o + VX] = d[o + VX]! + gravity.x * seconds;
      d[o + VX + 1] = d[o + VX + 1]! + gravity.y * seconds;
      d[o + X] = d[o + X]! + d[o + VX]! * seconds;
      d[o + X + 1] = d[o + X + 1]! + d[o + VX + 1]! * seconds;
      this.contain(o, 0, bounds.width);
      this.contain(o, 1, bounds.height);
      i++;
    }
  }

  /** Life runs 1 → 0 as the particle fades. */
  snapshot(): Float32Array<ArrayBuffer> {
    const out = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      const o = i * STRIDE;
      out.set(
        [
          this.data[o + X]!,
          this.data[o + X + 1]!,
          this.data[o + SIZE]!,
          1 - this.data[o + AGE]! / PARTICLE_LIFETIME,
        ],
        i * 4,
      );
    }
    return out;
  }

  private oldest(): number {
    let slot = 0;
    for (let i = 1; i < this.count; i++)
      if (this.data[i * STRIDE + AGE]! > this.data[slot * STRIDE + AGE]!)
        slot = i;
    return slot;
  }

  private contain(o: number, axis: 0 | 1, limit: number): void {
    const d = this.data;
    const half = d[o + SIZE]! / 2;
    const clamped = Math.fround(
      Math.min(limit - half, Math.max(half, d[o + X + axis]!)),
    );
    // Compared as float32: a resting particle's stored position is already rounded.
    if (clamped === d[o + X + axis]) return;
    d[o + X + axis] = clamped;
    d[o + VX + axis] = 0;
    d[o + VX + 1 - axis] = d[o + VX + 1 - axis]! * WALL_FRICTION;
  }
}
