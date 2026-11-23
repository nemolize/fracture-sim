import { describe, expect, it } from "vitest";

import {
  fracturePieces as splitWithToughness,
  MAX_HIT_PIECES,
  MIN_FRAGMENT_AREA,
  narrowestWidth,
  rigidPieces,
  splittableArea,
} from "./fracture";
import { polygonMoments } from "./polygon";
import type { Piece } from "./split";
import type { Vec2 } from "./vec2";

const CRACK_ENERGY = 12;
const fracturePieces = (domain: readonly Vec2[], point: Vec2, energy: number) =>
  splitWithToughness(domain, point, energy, CRACK_ENERGY);

const plate = [
  { x: -1, y: -0.5 },
  { x: 1, y: -0.5 },
  { x: 1, y: 0.5 },
  { x: -1, y: 0.5 },
];

describe("impact crack budget", () => {
  it("uses the narrowest support width even for rotated plates", () => {
    expect(narrowestWidth(plate)).toBe(1);
    const rotated = plate.map(({ x, y }) => ({
      x: (x - y) / Math.sqrt(2),
      y: (x + y) / Math.sqrt(2),
    }));
    expect(narrowestWidth(rotated)).toBeCloseTo(1, 14);
    expect(fracturePieces(plate, { x: 0, y: 0 }, CRACK_ENERGY)).toEqual([]);
    expect(
      fracturePieces(plate, { x: 0, y: 0 }, CRACK_ENERGY + 0.001).length,
    ).toBeGreaterThan(1);
  });

  it("moves the fine-fragment cluster with the impact point", () => {
    const center = fracturePieces(plate, { x: 0, y: 0 }, 96);
    const edge = fracturePieces(plate, { x: -1, y: 0 }, 96);
    const cluster = (pieces: typeof center): Vec2 => {
      const small = [...pieces].sort((a, b) => a.area - b.area).slice(0, 3);
      return {
        x: small.reduce((s, p) => s + p.centroidOffset.x, 0) / small.length,
        y: small.reduce((s, p) => s + p.centroidOffset.y, 0) / small.length,
      };
    };
    expect(
      Math.hypot(
        cluster(center).x - cluster(edge).x,
        cluster(center).y - cluster(edge).y,
      ),
    ).toBeGreaterThanOrEqual(0.5);
    for (const pieces of [center, edge]) {
      expect(pieces.length).toBeLessThanOrEqual(MAX_HIT_PIECES);
      expect(pieces.every((p) => p.area >= MIN_FRAGMENT_AREA)).toBe(true);
      expect(pieces.reduce((s, p) => s + p.area, 0)).toBeCloseTo(2, 14);
    }
  });

  it("keeps tiny fragments whole, and bounds high-energy hits", () => {
    const half = Math.sqrt(MIN_FRAGMENT_AREA) / 2;
    const tiny = plate.map(({ x, y }) => ({ x: x * half, y: y * half }));
    expect(fracturePieces(tiny, { x: 0, y: 0 }, 1e9)).toEqual([]);
    const pieces = fracturePieces(
      plate.map((p) => ({ x: p.x * 10, y: p.y * 10 })),
      { x: 0, y: 0 },
      1e9,
    );
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.length).toBe(40);
    const side = Math.sqrt(MIN_FRAGMENT_AREA / 2) * 1.01;
    expect(
      fracturePieces(
        plate.map((p) => ({ x: p.x * side, y: p.y * side * 2 })),
        { x: 0, y: 0 },
        100,
      ),
    ).toEqual([]);
  });

  it("rejects a split that would leave a fragment under the minimum", () => {
    const k = 0.03 * Math.sqrt(MIN_FRAGMENT_AREA / 0.0005);
    const edge = plate.map((p) => ({ x: p.x * k, y: p.y * k }));
    const pieces = fracturePieces(edge, { x: -k, y: -k / 5 }, 171.5);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((p) => p.area >= MIN_FRAGMENT_AREA)).toBe(true);
  });

  it("applies a caller-supplied minimum fragment area", () => {
    const small = plate.map((p) => ({ x: p.x * 0.05, y: p.y * 0.1 }));
    const minimum = 2e-5;
    const pieces = splitWithToughness(
      small,
      { x: 0, y: 0 },
      100,
      CRACK_ENERGY,
      minimum,
    );
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((p) => p.area >= minimum)).toBe(true);
    const area = polygonMoments(small).area;
    expect(
      splitWithToughness(small, { x: 0, y: 0 }, 100, CRACK_ENERGY, area),
    ).toEqual([]);
  });
});

it("keeps cracks inside a rotated plate and conserves its area", () => {
  const domain = plate.map(({ x, y }) => ({
    x: (x - y) / Math.sqrt(2),
    y: (x + y) / Math.sqrt(2),
  }));
  const pieces = fracturePieces(domain, { x: 0, y: 0 }, 96);
  expect(pieces.length).toBeGreaterThan(1);
  expect(pieces.reduce((sum, piece) => sum + piece.area, 0)).toBeCloseTo(2, 12);
  for (const piece of pieces) {
    for (const point of piece.domain) {
      const x = point.x + piece.centroidOffset.x;
      const y = point.y + piece.centroidOffset.y;
      expect(Math.abs((x + y) / Math.sqrt(2))).toBeLessThanOrEqual(1 + 1e-12);
      expect(Math.abs((y - x) / Math.sqrt(2))).toBeLessThanOrEqual(0.5 + 1e-12);
    }
  }
});

describe("rigidPieces", () => {
  const piece = (area: number): Piece => ({
    polygon: [],
    domain: [],
    centroidOffset: { x: 0, y: 0 },
    area,
    polarAreaMoment: 0,
  });
  const floor = splittableArea(MIN_FRAGMENT_AREA);

  it("keeps the pieces at or above the splittable area and drops the dust", () => {
    const [a, b, c] = [piece(floor), piece(floor / 2), piece(floor * 3)];
    expect(rigidPieces([a, b, c], MIN_FRAGMENT_AREA)).toEqual([a, c]);
  });

  it("keeps the largest piece when all of them are dust", () => {
    const [a, b, c] = [piece(0.0006), piece(0.0009), piece(0.0007)];
    expect(rigidPieces([a, b, c], MIN_FRAGMENT_AREA)).toEqual([b]);
  });

  it("follows the minimum fragment area it is given", () => {
    const [a, b] = [piece(floor / 2), piece(floor / 4)];
    expect(rigidPieces([a, b], MIN_FRAGMENT_AREA / 4)).toEqual([a, b]);
  });
});
