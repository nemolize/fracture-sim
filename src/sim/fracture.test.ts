import { describe, expect, it } from "vitest";

import {
  fracturePieces as splitWithToughness,
  MAX_HIT_PIECES,
  MIN_FRAGMENT_AREA,
  narrowestWidth,
} from "./fracture";
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
    const tiny = plate.map(({ x, y }) => ({ x: x * 0.05, y: y * 0.05 }));
    expect(fracturePieces(tiny, { x: 0, y: 0 }, 1e9)).toEqual([]);
    const pieces = fracturePieces(
      plate.map((p) => ({ x: p.x * 10, y: p.y * 10 })),
      { x: 0, y: 0 },
      1e9,
    );
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.length).toBe(40);
    expect(
      fracturePieces(
        plate.map((p) => ({ x: p.x * 0.05, y: p.y * 0.1 })),
        { x: 0, y: 0 },
        100,
      ),
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
