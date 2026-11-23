/* eslint-disable @typescript-eslint/no-non-null-assertion -- Domains are validated convex rings from the split module or box construction. */
import { polygonMoments } from "./polygon";
import { type Piece, splitConvex } from "./split";
import type { Vec2 } from "./vec2";

export const MIN_FRAGMENT_AREA = 0.01;
export const MAX_HIT_PIECES = 40;
// Below this a body can no longer split, and a fragment this small is dust, not a rigid body.
export const splittableArea = (minFragmentArea: number): number =>
  2 * minFragmentArea;

/** The pieces that stay rigid bodies; the largest always does, so a split never leaves only dust. */
export const rigidPieces = (
  pieces: readonly Piece[],
  minFragmentArea: number,
): Piece[] => {
  const large = pieces.filter(
    (piece) => piece.area >= splittableArea(minFragmentArea),
  );
  return large.length > 0
    ? large
    : [pieces.reduce((a, b) => (b.area > a.area ? b : a))];
};

const perimeter = (ring: readonly Vec2[]): number =>
  ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    return sum + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);

export const narrowestWidth = (ring: readonly Vec2[]): number =>
  Math.min(
    ...ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const projections = ring.map(
        (p) => ((b.x - a.x) * p.y - (b.y - a.y) * p.x) / length,
      );
      return Math.max(...projections) - Math.min(...projections);
    }),
  );

export type DustPiece = Pick<Piece, "area" | "centroidOffset">;

export type FractureResult =
  { kind: "split"; pieces: Piece[] } | { kind: "dust"; piece: DustPiece };

export const resolveFracture = (
  domain: readonly Vec2[],
  contact: Vec2,
  energy: number,
  crackEnergy: number,
  minFragmentArea = MIN_FRAGMENT_AREA,
): FractureResult | null => {
  if (!(energy / crackEnergy > narrowestWidth(domain))) return null;
  const { area, centroid } = polygonMoments(domain);
  if (area < splittableArea(minFragmentArea))
    return { kind: "dust", piece: { area, centroidOffset: centroid } };
  const pieces = fracturePieces(
    domain,
    contact,
    energy,
    crackEnergy,
    minFragmentArea,
  );
  return pieces.length > 1 ? { kind: "split", pieces } : null;
};

export const fracturePieces = (
  domain: readonly Vec2[],
  contact: Vec2,
  energy: number,
  crackEnergy: number,
  minFragmentArea = MIN_FRAGMENT_AREA,
): Piece[] => {
  const budget = energy / crackEnergy;
  const area = polygonMoments(domain).area;
  if (
    !(budget > narrowestWidth(domain)) ||
    area < splittableArea(minFragmentArea)
  )
    return [];
  const minX = Math.min(...domain.map((p) => p.x));
  const maxX = Math.max(...domain.map((p) => p.x));
  const minY = Math.min(...domain.map((p) => p.y));
  const maxY = Math.max(...domain.map((p) => p.y));
  // Empirical sampling density and radial spacing.
  const grid = Math.max(
    Math.sqrt(minFragmentArea) / 2,
    Math.max(maxX - minX, maxY - minY) / 64,
  );
  const candidates: Vec2[] = [];
  const columns = Math.ceil((maxX - minX) / grid);
  const rows = Math.ceil((maxY - minY) / grid);
  for (let column = 0; column < columns; column++) {
    const x = minX + ((column + 0.5) * (maxX - minX)) / columns;
    for (let row = 0; row < rows; row++) {
      const y = minY + ((row + 0.5) * (maxY - minY)) / rows;
      if (
        domain.every((a, i) => {
          const b = domain[(i + 1) % domain.length]!;
          return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) > 0;
        })
      )
        candidates.push({ x, y });
    }
  }
  const distance = (p: Vec2): number =>
    Math.hypot(p.x - contact.x, p.y - contact.y);
  candidates.sort((a, b) => distance(a) - distance(b));
  const seeds: Vec2[] = [];
  let pieces: Piece[] = [];
  const outer = perimeter(domain);
  for (const candidate of candidates) {
    const spacing = Math.sqrt(minFragmentArea) / 2 + distance(candidate) * 0.5;
    if (
      seeds.some(
        (s) => Math.hypot(s.x - candidate.x, s.y - candidate.y) < spacing,
      )
    )
      continue;
    const next = splitConvex(domain, [...seeds, candidate]);
    if (next.some((p) => p.area < minFragmentArea)) continue;
    const cost =
      (next.reduce((sum, p) => sum + perimeter(p.domain), 0) - outer) / 2;
    if (cost > budget) continue;
    seeds.push(candidate);
    pieces = next;
    if (pieces.length >= MAX_HIT_PIECES) break;
  }
  return pieces.length > 1 ? pieces : [];
};
