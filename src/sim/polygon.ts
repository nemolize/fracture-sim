/* eslint-disable @typescript-eslint/no-non-null-assertion -- Indices are bounded by validated polygon and seed lengths. */
import type { Vec2 } from "./vec2";

export const MAX_COLLISION_VERTICES = 8;

// Chosen empirically, no fixed source: share of the polygon's area below which a vertex is clipping noise.
const NOISE_AREA_RATIO = 1e-15;

const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

const triangleCross = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

export const signedArea = (vertices: readonly Vec2[]): number => {
  const origin = vertices[0]!;
  let twice = 0;
  for (let i = 1; i < vertices.length - 1; i++) {
    twice += triangleCross(origin, vertices[i]!, vertices[i + 1]!);
  }
  return twice / 2;
};

export interface Moments {
  area: number;
  /** Centroid in the input's frame. */
  centroid: Vec2;
  /** ∫|x − centroid|² dA, uniform density 1. */
  polarAreaMoment: number;
}

/**
 * Area, centroid and polar moment of a counter-clockwise polygon.
 * Throws if positive finite area and polar moment cannot be represented.
 */
export const polygonMoments = (vertices: readonly Vec2[]): Moments => {
  const origin = vertices[0]!;
  const scale = Math.max(
    ...vertices.flatMap((v) => [
      Math.abs(v.x - origin.x),
      Math.abs(v.y - origin.y),
    ]),
  );
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  let polar = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    const p = { x: (a.x - origin.x) / scale, y: (a.y - origin.y) / scale };
    const q = { x: (b.x - origin.x) / scale, y: (b.y - origin.y) / scale };
    const w = cross(p, q);
    twiceArea += w;
    cx += w * (p.x + q.x);
    cy += w * (p.y + q.y);
    polar +=
      w *
      (p.x * p.x + p.y * p.y + p.x * q.x + p.y * q.y + q.x * q.x + q.y * q.y);
  }
  const unitArea = twiceArea / 2;
  const local = { x: cx / (6 * unitArea), y: cy / (6 * unitArea) };
  const scaleSquared = scale * scale;
  const area = unitArea * scaleSquared;
  const polarAreaMoment =
    (polar / 12 - unitArea * (local.x * local.x + local.y * local.y)) *
    scaleSquared *
    scaleSquared;
  if (
    !(area > 0) ||
    !(polarAreaMoment > 0) ||
    !Number.isFinite(area) ||
    !Number.isFinite(polarAreaMoment)
  )
    throw new Error("unrepresentable polygon moments");
  return {
    area,
    centroid: { x: origin.x + local.x * scale, y: origin.y + local.y * scale },
    polarAreaMoment,
  };
};

/** Drops consecutive duplicates and vertices whose triangle with their neighbours is noise. */
export const removeNoiseVertices = (
  vertices: readonly Vec2[],
  area: number,
): Vec2[] => {
  const limit = NOISE_AREA_RATIO * Math.abs(area);
  const kept = [...vertices];
  let changed = true;
  while (changed && kept.length > 3) {
    changed = false;
    for (let i = 0; i < kept.length; i++) {
      const prev = kept[(i + kept.length - 1) % kept.length]!;
      const next = kept[(i + 1) % kept.length]!;
      if (Math.abs(triangleCross(prev, kept[i]!, next)) / 2 <= limit) {
        kept.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return kept;
};

/** Reduces a convex polygon to `max` vertices, each time dropping the one that costs the least area. */
export const reduceVertices = (
  vertices: readonly Vec2[],
  max: number,
): Vec2[] => {
  const kept = [...vertices];
  while (kept.length > max) {
    let cheapest = 0;
    let cost = Infinity;
    for (let i = 0; i < kept.length; i++) {
      const prev = kept[(i + kept.length - 1) % kept.length]!;
      const next = kept[(i + 1) % kept.length]!;
      const triangle = Math.abs(triangleCross(prev, kept[i]!, next));
      if (triangle < cost) {
        cost = triangle;
        cheapest = i;
      }
    }
    kept.splice(cheapest, 1);
  }
  return kept;
};

/**
 * Checks that `vertices` is a finite, simple, convex polygon, and returns it
 * counter-clockwise without a repeated closing vertex or collinear middle
 * vertices. Throws on anything else.
 */
export const normalizeConvex = (vertices: readonly Vec2[]): Vec2[] => {
  for (const v of vertices) {
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
      throw new Error("parent has a non-finite coordinate");
    }
  }
  let ring = [...vertices];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (
    first &&
    last &&
    ring.length > 1 &&
    first.x === last.x &&
    first.y === last.y
  ) {
    ring.pop();
  }
  const distinct = new Set(ring.map((v) => `${String(v.x)},${String(v.y)}`));
  if (distinct.size !== ring.length)
    throw new Error("parent has a repeated vertex");
  if (ring.length < 3)
    throw new Error("parent needs at least 3 distinct vertices");
  const area = signedArea(ring);
  if (area < 0) ring.reverse();
  if (!Number.isFinite(area) || area === 0)
    throw new Error("parent has no area");

  const turn = (i: number): number => {
    const prev = ring[(i + ring.length - 1) % ring.length]!;
    const next = ring[(i + 1) % ring.length]!;
    return triangleCross(prev, ring[i]!, next);
  };
  for (let i = 0; i < ring.length; i++) {
    if (turn(i) < 0) throw new Error("parent is not convex");
    const a = ring[(i + ring.length - 1) % ring.length]!;
    const b = ring[i]!;
    const c = ring[(i + 1) % ring.length]!;
    if (
      turn(i) === 0 &&
      (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) < 0
    )
      throw new Error("parent has overlapping edges");
  }
  ring = ring.filter((_, i) => turn(i) !== 0);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (ring.some((p) => triangleCross(a, b, p) < 0)) {
      throw new Error("parent is self-intersecting");
    }
  }
  return ring;
};
