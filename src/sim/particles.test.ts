import { expect, it } from "vitest";

import { ObstacleGrid } from "./obstacles";
import { MAX_PARTICLES, ParticleField } from "./particles";

const BOUNDS = { width: 10, height: 5 };
const NO_GRAVITY = { x: 0, y: 0 };

it("moves a particle under gravity", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 3 }, { x: 1, y: 0 }, 0.02);
  field.step(0.5, { x: 0, y: -2 }, BOUNDS);
  expect(field.size).toBe(1);
  const [x, y, size] = field.snapshot();
  expect(x).toBeCloseTo(5.5, 6);
  expect(y).toBeCloseTo(2.5, 6);
  expect(size).toBeCloseTo(0.02, 6);
});

it("rests on the floor and slows sideways motion there", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 0.5 }, { x: 1, y: -10 }, 0.1);
  field.step(0.1, NO_GRAVITY, BOUNDS);
  const [x, y, size] = field.snapshot();
  expect(y).toBeCloseTo((size ?? 0) / 2, 6);
  expect(x).toBeCloseTo(5.1, 6);
  field.step(0.1, NO_GRAVITY, BOUNDS);
  expect(field.snapshot()[0]).toBeCloseTo(5.1 + 0.09, 6);
});

it("keeps particles inside every wall, whichever way gravity points", () => {
  for (const gravity of [
    { x: -50, y: 0 },
    { x: 50, y: 0 },
    { x: 0, y: -50 },
    { x: 0, y: 50 },
  ]) {
    const field = new ParticleField();
    field.spawn({ x: 5, y: 2.5 }, { x: 0, y: 0 }, 0.1);
    for (let i = 0; i < 60; i++) field.step(1 / 60, gravity, BOUNDS);
    const [x = NaN, y = NaN, size = 0] = field.snapshot();
    const half = size / 2;
    expect(x).toBeGreaterThanOrEqual(half - 1e-6);
    expect(x).toBeLessThanOrEqual(BOUNDS.width - half + 1e-6);
    expect(y).toBeGreaterThanOrEqual(half - 1e-6);
    expect(y).toBeLessThanOrEqual(BOUNDS.height - half + 1e-6);
  }
});

it("keeps a particle, at its spawn size, however long it has been alive", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 3 }, { x: 0, y: 0 }, 0.02);
  for (let i = 0; i < 3600; i++) field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS);
  expect(field.size).toBe(1);
  expect(field.snapshot()[2]).toBeCloseTo(0.02, 6);
});

it("replaces the oldest particle once the field is full", () => {
  const field = new ParticleField();
  for (let i = 0; i < MAX_PARTICLES; i++)
    field.spawn({ x: 1 + i / MAX_PARTICLES, y: 1 }, { x: 0, y: 0 }, 0.01);
  field.step(0.5, NO_GRAVITY, BOUNDS);
  field.spawn({ x: 9, y: 1 }, { x: 0, y: 0 }, 0.01);
  expect(field.size).toBe(MAX_PARTICLES);
  const xs = [...field.snapshot()].filter((_, i) => i % 3 === 0);
  expect(xs).toContain(9);
  expect(xs).not.toContain(1);
});

it("lets a particle resting against a side wall fall freely, whatever its size", () => {
  for (let size = 0.011; size < 0.03; size += 0.0007) {
    for (const x of [BOUNDS.width - 0.001, 0.001]) {
      const field = new ParticleField();
      field.spawn({ x, y: 3 }, { x: x > 1 ? 1 : -1, y: 0 }, size);
      for (let i = 0; i < 30; i++)
        field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS);
      // Free fall for 0.5 s drops about 1.2 m.
      expect(field.snapshot()[1]).toBeLessThan(2);
    }
  }
});

it("keeps a resting particle in contact with the floor and in place", () => {
  const field = new ParticleField();
  const size = 0.1;
  field.spawn({ x: 5, y: 0.5 }, { x: 0, y: 0 }, size);
  for (let i = 0; i < 60; i++) field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS);
  const [x, y] = field.snapshot();
  for (let i = 0; i < 600; i++) field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS);
  const [laterX, laterY] = field.snapshot();
  expect(y).toBeCloseTo(size / 2, 5);
  expect(
    Math.hypot((laterX ?? 0) - (x ?? 0), (laterY ?? 0) - (y ?? 0)),
  ).toBeLessThan(1e-3);
});

const slab = () => {
  const grid = new ObstacleGrid(0.5, 10, 5);
  grid.rebuild([
    {
      centre: { x: 5, y: 1 },
      extent: Math.hypot(1, 0.25),
      ring: [
        { x: 4, y: 0.75 },
        { x: 6, y: 0.75 },
        { x: 6, y: 1.25 },
        { x: 4, y: 1.25 },
      ],
    },
  ]);
  return grid;
};

it("rests a falling particle on a body instead of passing through it", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 2 }, { x: 0, y: 0 }, 0.1);
  const grid = slab();
  for (let i = 0; i < 90; i++)
    field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS, grid);
  const [x, y, size] = field.snapshot();
  expect(y).toBeCloseTo(1.25 + (size ?? 0) / 2, 3);
  for (let i = 0; i < 600; i++)
    field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS, grid);
  const [laterX, laterY] = field.snapshot();
  expect(
    Math.hypot((laterX ?? 0) - (x ?? 0), (laterY ?? 0) - (y ?? 0)),
  ).toBeLessThan(1e-3);
});

it("keeps sliding along a body's surface and slows down there", () => {
  const field = new ParticleField();
  field.spawn({ x: 4.2, y: 1.3 }, { x: 2, y: 0 }, 0.1);
  const grid = slab();
  for (let i = 0; i < 6; i++)
    field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS, grid);
  const [x] = field.snapshot();
  expect(x).toBeGreaterThan(4.2);
  expect(x).toBeLessThan(4.2 + (2 * 6) / 60);
});

it("leaves a particle moving away from a body alone", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 1.26 }, { x: 0, y: 0.5 }, 0.1);
  field.step(1 / 60, NO_GRAVITY, BOUNDS, slab());
  const [, y] = field.snapshot();
  expect(y).toBeGreaterThan(1.29);
  field.step(1 / 60, NO_GRAVITY, BOUNDS);
  expect((field.snapshot()[1] ?? 0) - (y ?? 0)).toBeCloseTo(0.5 / 60, 4);
});

it("slows a slide once per step", () => {
  const field = new ParticleField();
  field.spawn({ x: 4.2, y: 1.27 }, { x: 3, y: 0 }, 0.04);
  field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS, slab());
  const [first] = field.snapshot();
  field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS, slab());
  const [second] = field.snapshot();
  expect(((second ?? 0) - (first ?? 0)) * 60).toBeCloseTo(3 * 0.9, 1);
});

it("does not let a fast particle skip over a thin body, whatever height it starts from", () => {
  const grid = new ObstacleGrid(0.5, 10, 5);
  grid.rebuild([
    {
      centre: { x: 5, y: 1.01 },
      extent: Math.hypot(1, 0.01),
      ring: [
        { x: 4, y: 1 },
        { x: 6, y: 1 },
        { x: 6, y: 1.02 },
        { x: 4, y: 1.02 },
      ],
    },
  ]);
  for (let start = 1.2; start < 1.3; start += 0.005) {
    const field = new ParticleField();
    field.spawn({ x: 5, y: start }, { x: 0, y: -24 }, 0.04);
    for (let i = 0; i < 6; i++) field.step(1 / 60, NO_GRAVITY, BOUNDS, grid);
    expect(field.snapshot()[1]).toBeGreaterThan(1.02);
  }
});

it("pushes a particle that spawns inside a body out of it", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 1.2 }, { x: 0, y: 0 }, 0.1);
  field.step(1 / 60, NO_GRAVITY, BOUNDS, slab());
  const [, y, size] = field.snapshot();
  expect(y).toBeCloseTo(1.25 + (size ?? 0) / 2, 3);
});

it("lets a particle that rested on a body fall once the body is gone", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 2 }, { x: 0, y: 0 }, 0.1);
  const grid = slab();
  for (let i = 0; i < 90; i++)
    field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS, grid);
  for (let i = 0; i < 90; i++) field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS);
  expect(field.snapshot()[1]).toBeCloseTo(0.05, 3);
});

it("stops a particle sliding fast on one body at a body standing on it", () => {
  const field = new ParticleField();
  const grid = new ObstacleGrid(0.5, 10, 5);
  const box = (x0: number, y0: number, x1: number, y1: number) => ({
    centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
    extent: Math.hypot(x1 - x0, y1 - y0) / 2,
    ring: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  });
  grid.rebuild([box(0, 0, 3, 1), box(1, 1, 1.1, 1.5)]);
  for (const speed of [4.5, 8, 12]) {
    field.spawn({ x: 0.3, y: 1.03 }, { x: speed, y: 0 }, 0.06);
  }
  for (let i = 0; i < 30; i++)
    field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS, grid);
  const xs = [...field.snapshot()].filter((_, i) => i % 3 === 0);
  for (const x of xs) expect(x).toBeLessThanOrEqual(1);
});

it("stops a particle sliding on a tilted body at a body standing on it", () => {
  for (const degrees of [-5, 2, 5, 10]) {
    const angle = (degrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const turn = (x: number, y: number) => ({
      x: 2.5 + (x - 2.5) * cos - (y - 0.5) * sin,
      y: 0.5 + (x - 2.5) * sin + (y - 0.5) * cos,
    });
    const box = (x0: number, y0: number, x1: number, y1: number) => ({
      centre: turn((x0 + x1) / 2, (y0 + y1) / 2),
      extent: Math.hypot(x1 - x0, y1 - y0) / 2,
      ring: [turn(x0, y0), turn(x1, y0), turn(x1, y1), turn(x0, y1)],
    });
    const grid = new ObstacleGrid(0.5, 10, 5);
    grid.rebuild([box(0, 0, 5, 1), box(1, 1, 1.1, 1.5)]);
    for (let start = 0.2; start < 0.9; start += 0.0173) {
      const field = new ParticleField();
      const at = turn(start, 1.03);
      field.spawn(at, { x: 8 * cos, y: 8 * sin }, 0.06);
      for (let i = 0; i < 30; i++)
        field.step(1 / 60, { x: 0, y: -9.8 }, { width: 10, height: 5 }, grid);
      const [x = 0, y = 0] = field.snapshot();
      const along = (x - 2.5) * cos + (y - 0.5) * sin + 2.5;
      expect(along).toBeLessThanOrEqual(1);
    }
  }
});

it("never leaves a resting particle inside a thin body once its position is stored", () => {
  const grid = new ObstacleGrid(0.5, 10, 5);
  grid.rebuild([
    {
      centre: { x: 5, y: 1.01 },
      extent: Math.hypot(1, 0.01),
      ring: [
        { x: 4, y: 1 },
        { x: 6, y: 1 },
        { x: 6, y: 1.02 },
        { x: 4, y: 1.02 },
      ],
    },
  ]);
  for (let start = 1.5; start < 1.6; start += 0.0137) {
    const field = new ParticleField();
    field.spawn({ x: 5, y: start }, { x: 0, y: 0 }, 0.04);
    for (let i = 0; i < 90; i++) {
      field.step(1 / 60, { x: 0, y: -9.8 }, BOUNDS, grid);
      const [, y = 0, size = 0] = field.snapshot();
      expect(y).toBeGreaterThanOrEqual(1.02 + size / 2);
    }
  }
});
