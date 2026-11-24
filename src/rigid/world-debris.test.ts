/* eslint-disable @typescript-eslint/dot-notation -- Inspect real engine fixtures without exposing mutation APIs to the app. */
import { afterEach, beforeAll, expect, it } from "vitest";

import { DEBRIS_STRIDE, MAX_DEBRIS, TIME_STEP } from "./constants";
import { DEFAULT_ENVIRONMENT } from "./environment";
import { live } from "./live";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
const PLATE = { width: 2, height: 1 };
const PLATE_MASS = 50;
const GRAVITY = { x: 0, y: -9.8 };
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});

const makeWorld = () => {
  world = new RigidWorld(undefined, PLATE);
  return world;
};

const dust = (x: number, y: number, mass = 1, speed = 0) => ({
  position: { x, y },
  velocity: { x: 0, y: -speed },
  angularVelocity: 0,
  radius: 0.1,
  mass,
  friction: 0.5,
  restitution: 0,
});

const advance = (target: RigidWorld, steps: number, crackEnergy = 12) => {
  for (let i = 0; i < steps; i++)
    target.advance(TIME_STEP, GRAVITY, live(crackEnergy));
};

it("keeps debris counted in the world mass until it is replaced", () => {
  const target = makeWorld();
  for (let i = 0; i < MAX_DEBRIS; i++)
    target["debris"].spawn(dust(0.2 + (i % 90) * 0.1, 1.5 + (i / 90) * 0.1));
  expect(target.snapshot().stats.particles).toBe(MAX_DEBRIS);
  expect(target.snapshot().stats.mass).toBe(PLATE_MASS + MAX_DEBRIS);
  target["debris"].spawn(dust(5, 9, 3));
  expect(target.snapshot().stats.particles).toBe(MAX_DEBRIS);
  expect(target.snapshot().stats.mass).toBe(PLATE_MASS + MAX_DEBRIS + 2);
});

it("does not count debris as a body or let it take part in picking", () => {
  const target = makeWorld();
  target["debris"].spawn(dust(5, 2));
  expect(target.snapshot().stats.bodies).toBe(1);
  expect(target["shapes"]).toHaveLength(5);
});

it("ignores a grab aimed at debris", () => {
  const target = makeWorld();
  target["debris"].spawn(dust(5, 3));
  target.apply({ type: "grab", point: { x: 5, y: 3 } });
  target.apply({ type: "move", point: { x: 8, y: 3 } });
  advance(target, 30);
  expect(target.snapshot().particles[0]).toBeCloseTo(5, 1);
});

it("keeps debris inside the container while gravity turns all the way round", () => {
  const target = makeWorld();
  for (let i = 0; i < 300; i++)
    target["debris"].spawn(
      dust(0.5 + (i % 30) * 0.3, 0.3 + Math.floor(i / 30) * 0.3),
    );
  for (let i = 0; i < 360; i++) {
    const angle = i * 0.05;
    target.advance(
      TIME_STEP,
      { x: 9.8 * Math.sin(angle), y: -9.8 * Math.cos(angle) },
      live(12),
    );
  }
  const { particles } = target.snapshot();
  for (let i = 0; i < particles.length; i += DEBRIS_STRIDE) {
    expect(particles[i]).toBeGreaterThanOrEqual(0);
    expect(particles[i]).toBeLessThanOrEqual(DEFAULT_ENVIRONMENT.width);
    expect(particles[i + 1]).toBeGreaterThanOrEqual(0);
  }
});

it("lets fast heavy debris hit a plate without cracking it, where a ball cracks it", () => {
  const ballWorld = makeWorld();
  ballWorld["shapes"][4]?.body.setTranslation({ x: 5, y: 0.5 }, true);
  ballWorld.apply({
    type: "throw",
    point: { x: 5, y: 3 },
    velocity: { x: 0, y: -30 },
  });
  advance(ballWorld, 60, 1);
  expect(ballWorld.snapshot().stats.bodies).toBeGreaterThan(2);
  ballWorld.dispose();

  const debrisWorld = makeWorld();
  debrisWorld["shapes"][4]?.body.setTranslation({ x: 5, y: 0.5 }, true);
  debrisWorld["debris"].spawn(dust(5, 3, 20, 30));
  advance(debrisWorld, 60, 1);
  expect(debrisWorld.snapshot().stats.bodies).toBe(1);
  expect(debrisWorld.snapshot().stats.particles).toBe(1);
});

it("wakes resting debris when gravity turns", () => {
  const target = makeWorld();
  target["debris"].spawn(dust(5, 0.5));
  advance(target, 240);
  const circle = () => target["debris"]["slots"][0]?.body;
  expect(circle()?.isSleeping()).toBe(true);
  for (let i = 0; i < 30; i++)
    target.advance(TIME_STEP, { x: 4, y: -9 }, live(12));
  expect(circle()?.isSleeping()).toBe(false);
});

it("applies a changed object material to existing debris", () => {
  const target = makeWorld();
  target["debris"].spawn(dust(5, 0.5));
  target.advance(
    TIME_STEP,
    GRAVITY,
    live(12, { object: { friction: 0.9, restitution: 0.3 } }),
  );
  const collider = target["debris"]["slots"][0]?.body.collider(0);
  expect(collider?.friction()).toBeCloseTo(0.9, 6);
  expect(collider?.restitution()).toBeCloseTo(0.3, 6);
});
