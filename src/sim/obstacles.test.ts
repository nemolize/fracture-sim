import { expect, it } from "vitest";

import { type Obstacle, ObstacleGrid } from "./obstacles";

const box = (x0: number, y0: number, x1: number, y1: number): Obstacle => ({
  centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
  extent: Math.hypot(x1 - x0, y1 - y0) / 2,
  ring: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
});

const triangle = (): Obstacle => ({
  centre: { x: 5, y: 2.33 },
  extent: 1,
  ring: [
    { x: 4.5, y: 2 },
    { x: 5.5, y: 2 },
    { x: 5, y: 3 },
  ],
});

const makeGrid = (...obstacles: Obstacle[]) => {
  const grid = new ObstacleGrid(0.5, 10, 5);
  grid.rebuild(obstacles);
  return grid;
};

const slab = () => box(4, 1, 6, 1.02);

it("reports nothing for a square that stays clear of every body", () => {
  const grid = makeGrid(box(4, 1, 6, 3));
  expect(grid.sweep(5, 4, 5, 3.5, 0.1)).toBeNull();
  expect(grid.sweep(1, 1, 1, 1, 0.1)).toBeNull();
  expect(grid.sweep(7, 2, 6.5, 2, 0.1)).toBeNull();
});

it("stops a falling square on the face it came through and slides the rest of the move", () => {
  const grid = makeGrid(box(4, 1, 6, 3));
  const hit = grid.sweep(5, 3.4, 5, 2.8, 0.1);
  expect([hit?.nx, hit?.ny]).toEqual([0, 1]);
  expect(hit?.y).toBeCloseTo(3.1, 4);
  expect(hit?.fraction).toBeCloseTo(0.5, 12);
  expect(hit?.fraction).toBeLessThan(1);
});

it("lets a square graze a body without touching it", () => {
  const grid = makeGrid(box(4, 1, 6, 3));
  expect(grid.sweep(6.3, 3.12, 6.2, 3.12, 0.1)).toBeNull();
  expect(grid.sweep(6.3, 3.3, 6.12, 3.12, 0.1)).toBeNull();
  expect(grid.sweep(6.3, 3.3, 6.05, 3.05, 0.1)).not.toBeNull();
});

it("measures an acute tip by the square's own extent, not by a circle", () => {
  const grid = makeGrid(triangle());
  // The square's underside stays 1 mm above the apex the whole way across.
  expect(grid.sweep(4.98, 3.021, 5.0106, 3.021, 0.02)).toBeNull();
  const hit = grid.sweep(5, 3.2, 5, 3.0, 0.02);
  expect(hit?.ny).toBe(1);
  expect(hit?.y).toBeCloseTo(3.02, 4);
});

it("pushes a square that already overlaps out through its shallowest face", () => {
  const grid = makeGrid(box(4, 1, 6, 3));
  const hit = grid.sweep(5, 2.9, 5, 2.9, 0.1);
  expect(hit?.fraction).toBe(1);
  expect([hit?.nx, hit?.ny]).toEqual([0, 1]);
  expect(hit?.y).toBeCloseTo(3.1, 4);
  const side = grid.sweep(4.05, 2, 4.05, 2, 0.1);
  expect(side?.nx).toBe(-1);
  expect(side?.x).toBeCloseTo(3.9, 4);
  expect(grid.sweep(5, 3.05, 5, 3.3, 0.1)).toBeNull();
});

it("catches a fast square on a thin body whatever height it starts from", () => {
  const grid = makeGrid(slab());
  for (let start = 1.1; start < 1.4; start += 0.01) {
    const hit = grid.sweep(5, start, 5, start - 0.4, 0.02);
    expect(hit?.ny).toBe(1);
    expect(hit?.y).toBeCloseTo(1.04, 4);
  }
});

it("takes the first of several bodies on the way", () => {
  const grid = makeGrid(box(4, 1, 6, 2), box(4, 3, 6, 4));
  const first = grid.sweep(5, 5, 5, 0.5, 0.1);
  expect(first?.y).toBeCloseTo(4.1, 4);
});

it("stops a square that starts on a thin body's face and moves in, however fast", () => {
  const grid = makeGrid(slab());
  const hit = grid.sweep(5, 1.04, 5, 0.9, 0.02);
  expect(hit?.ny).toBe(1);
  expect(hit?.y).toBeCloseTo(1.04, 4);
  expect(grid.sweep(4.5, 1.04, 5.5, 1.04, 0.02)).toBeNull();
});

it("falls back to pushing a square out when no body is entered on the way", () => {
  const grid = makeGrid(box(4, 1, 6, 3));
  expect(grid.sweep(5, 3.05, 5, 2.95, 0.1)?.fraction).toBe(1);
});

it("sweeps across several cells and meets each body once", () => {
  const grid = makeGrid(box(1, 1, 9, 1.5));
  const hit = grid.sweep(1, 3, 9, 1, 0.1);
  expect(hit).not.toBeNull();
  expect(grid.sweep(-3, -3, -3, -3, 0.1)).toBeNull();
  expect(grid.sweep(30, 30, 31, 31, 0.1)).toBeNull();
});

it("cuts a half-width larger than one cell to the cell, which the grid's reach covers", () => {
  const grid = makeGrid(box(4, 1, 6, 3));
  const hit = grid.sweep(5, 4, 5, 3.2, 100);
  expect(hit?.y).toBeCloseTo(3.5, 4);
});

it("forgets the previous bodies on rebuild", () => {
  const grid = makeGrid(box(4, 1, 6, 3));
  grid.rebuild([]);
  expect(grid.sweep(5, 4, 5, 2, 0.1)).toBeNull();
});

it("holds at least one cell for a degenerate size", () => {
  const grid = new ObstacleGrid(1, 0, 0);
  grid.rebuild([box(-0.5, -0.5, 0.5, 0.5)]);
  expect(grid.sweep(0, 1, 0, 0, 0.1)).not.toBeNull();
});
