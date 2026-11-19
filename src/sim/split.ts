/* eslint-disable @typescript-eslint/no-non-null-assertion -- Indices are bounded by validated polygon and seed lengths. */
import {
  MAX_COLLISION_VERTICES,
  normalizeConvex,
  polygonMoments,
  reduceVertices,
  removeNoiseVertices,
} from "./polygon";
import type { Vec2 } from "./vec2";

/**
 * One piece of a split. Uniform density 1, so `area` is also its mass.
 * `domain` and `polygon` are relative to the piece's own centroid; the next
 * split must take `domain`, because `polygon` has lost area to the reduction.
 */
export interface Piece {
  /** True clipped polygon, counter-clockwise. */
  domain: Vec2[];
  /** Collision polygon: `domain` reduced to at most {@link MAX_COLLISION_VERTICES} vertices. */
  polygon: Vec2[];
  /** Parent centroid to this piece's true centroid, in the parent's frame. */
  centroidOffset: Vec2;
  /** True clipped area. */
  area: number;
  /** ∫|x − centroid|² dA of `domain`. */
  polarAreaMoment: number;
}

const DEGENERATE_CELL_RATIO = 64 * Number.EPSILON;

const keepNearer = (
  ring: readonly Vec2[],
  seed: Vec2,
  other: Vec2,
  origin: Vec2,
): Vec2[] => {
  const dx = other.x - seed.x;
  const dy = other.y - seed.y;
  const mx = (seed.x - origin.x + (other.x - origin.x)) / 2;
  const my = (seed.y - origin.y + (other.y - origin.y)) / 2;
  const side = (p: Vec2): number => (p.x - mx) * dx + (p.y - my) * dy;
  const out: Vec2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const fa = side(a);
    const fb = side(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
};

const assertInterior = (ring: readonly Vec2[], seed: Vec2): void => {
  if (!Number.isFinite(seed.x) || !Number.isFinite(seed.y)) {
    throw new Error("seed has a non-finite coordinate");
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const distance =
      ((b.x - a.x) * (seed.y - a.y) - (b.y - a.y) * (seed.x - a.x)) / length;
    if (distance <= 0) {
      throw new Error("seed is not strictly inside the parent");
    }
  }
};

/**
 * Splits a convex polygon into one Voronoi cell per seed, in seed order.
 * Throws on invalid input instead of dropping a seed: no seeds, duplicate
 * seeds, a seed outside or on the boundary, a parent that is not a finite
 * convex polygon, or a degenerate cell (area / parent area <= 64 * Number.EPSILON).
 * Throws if polygon moments cannot be represented as positive finite numbers.
 */
export const splitConvex = (
  parent: readonly Vec2[],
  seeds: readonly Vec2[],
): Piece[] => {
  if (seeds.length === 0) throw new Error("no seeds");
  const ring = normalizeConvex(parent);
  for (const point of seeds) assertInterior(ring, point);
  const origin = ring[0]!;
  const local = ring.map((v) => ({ x: v.x - origin.x, y: v.y - origin.y }));
  const whole = polygonMoments(local);

  return seeds.map((seed, i) => {
    let cell = local;
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      const other = seeds[j]!;
      if (other.x === seed.x && other.y === seed.y) {
        throw new Error("duplicate seeds");
      }
      cell = keepNearer(cell, seed, other, origin);
    }
    const clean = removeNoiseVertices(cell, polygonMoments(cell).area);
    const moments = polygonMoments(clean);
    if (!(moments.area / whole.area > DEGENERATE_CELL_RATIO)) {
      throw new Error("a seed's cell has no area");
    }
    const domain = clean.map((v) => ({
      x: v.x - moments.centroid.x,
      y: v.y - moments.centroid.y,
    }));
    return {
      domain,
      polygon: reduceVertices(domain, MAX_COLLISION_VERTICES),
      centroidOffset: {
        x: moments.centroid.x - whole.centroid.x,
        y: moments.centroid.y - whole.centroid.y,
      },
      area: moments.area,
      polarAreaMoment: moments.polarAreaMoment,
    };
  });
};
