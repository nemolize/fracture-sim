import { expect, it } from "vitest";

import { MAX_PARTICLES, PARTICLE_LIFETIME, ParticleField } from "./particles";

const BOUNDS = { width: 10, height: 5 };
const NO_GRAVITY = { x: 0, y: 0 };

it("moves a particle under gravity and reports its remaining life", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 3 }, { x: 1, y: 0 }, 0.02);
  field.step(0.5, { x: 0, y: -2 }, BOUNDS);
  expect(field.size).toBe(1);
  const [x, y, size, life] = field.snapshot();
  expect(x).toBeCloseTo(5.5, 6);
  expect(y).toBeCloseTo(2.5, 6);
  expect(size).toBeCloseTo(0.02, 6);
  expect(life).toBeCloseTo(1 - 0.5 / PARTICLE_LIFETIME, 6);
});

it("rests on the floor and slows sideways motion there", () => {
  const field = new ParticleField();
  field.spawn({ x: 5, y: 0.5 }, { x: 1, y: -10 }, 0.1);
  field.step(0.1, NO_GRAVITY, BOUNDS);
  const [x, y] = field.snapshot();
  expect(y).toBeCloseTo(0.05, 6);
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
    const [x, y] = field.snapshot();
    expect(x).toBeGreaterThanOrEqual(0.05 - 1e-6);
    expect(x).toBeLessThanOrEqual(BOUNDS.width - 0.05 + 1e-6);
    expect(y).toBeGreaterThanOrEqual(0.05 - 1e-6);
    expect(y).toBeLessThanOrEqual(BOUNDS.height - 0.05 + 1e-6);
  }
});

it("drops expired particles and keeps the others", () => {
  const field = new ParticleField();
  field.spawn({ x: 1, y: 1 }, { x: 0, y: 0 }, 0.01);
  field.step(PARTICLE_LIFETIME - 0.5, NO_GRAVITY, BOUNDS);
  field.spawn({ x: 2, y: 1 }, { x: 0, y: 0 }, 0.01);
  field.spawn({ x: 3, y: 1 }, { x: 0, y: 0 }, 0.01);
  field.step(0.6, NO_GRAVITY, BOUNDS);
  expect(field.size).toBe(2);
  expect([...field.snapshot()].filter((_, i) => i % 4 === 0)).toEqual([3, 2]);
  field.step(PARTICLE_LIFETIME, NO_GRAVITY, BOUNDS);
  expect(field.size).toBe(0);
  expect(field.snapshot()).toHaveLength(0);
});

it("replaces the oldest particle once the field is full", () => {
  const field = new ParticleField();
  for (let i = 0; i < MAX_PARTICLES; i++)
    field.spawn({ x: 1 + i / MAX_PARTICLES, y: 1 }, { x: 0, y: 0 }, 0.01);
  // Age the first half, drop none, then expire nothing: x = 1 is the oldest.
  field.step(0.5, NO_GRAVITY, BOUNDS);
  field.spawn({ x: 9, y: 1 }, { x: 0, y: 0 }, 0.01);
  expect(field.size).toBe(MAX_PARTICLES);
  const xs = [...field.snapshot()].filter((_, i) => i % 4 === 0);
  expect(xs).toContain(9);
  expect(xs).not.toContain(1);
});

it("replaces the oldest particle even after an expiry reordered the field", () => {
  const field = new ParticleField();
  const spawn = (x: number) => {
    field.spawn({ x, y: 1 }, { x: 0, y: 0 }, 0.01);
  };
  spawn(1);
  field.step(1, NO_GRAVITY, BOUNDS);
  spawn(2);
  field.step(0.5, NO_GRAVITY, BOUNDS);
  const lastX = 3 + MAX_PARTICLES / 1000;
  for (let i = 0; i < MAX_PARTICLES - 2; i++)
    spawn(i === MAX_PARTICLES - 3 ? lastX : 3);
  field.step(0.6, NO_GRAVITY, BOUNDS);
  // The first particle expired and the last one moved into its slot.
  expect(field.size).toBe(MAX_PARTICLES - 1);
  spawn(8);
  spawn(9);
  expect(field.size).toBe(MAX_PARTICLES);
  const xs = [...field.snapshot()].filter((_, i) => i % 4 === 0);
  expect(xs).not.toContain(2);
  expect(xs).toContain(9);
  expect(xs).toContain(Math.fround(lastX));
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
