import { describe, expect, it } from "vitest";

import {
  applyBlast,
  collideBounds,
  DEFAULT_GRAVITY,
  stepBall,
} from "./contact";
import type { Solid } from "./solid";

/** Three free nodes, enough for the contact helpers; the triangle arrays are unused. */
const nodes = (
  x: number[],
  y: number[],
  vx: number[],
  vy: number[],
): Solid => ({
  nodeCount: x.length,
  triCount: 0,
  x: Float64Array.from(x),
  y: Float64Array.from(y),
  vx: Float64Array.from(vx),
  vy: Float64Array.from(vy),
  fx: new Float64Array(x.length),
  fy: new Float64Array(x.length),
  mass: new Float64Array(x.length).fill(1),
  nodeRefs: new Int32Array(x.length).fill(1),
  tri: new Int32Array(0),
  restInverse: new Float64Array(0),
  plasticInverse: new Float64Array(0),
  restArea: new Float64Array(0),
  plasticStrain: new Float64Array(0),
  damage: new Float64Array(0),
  stressRatio: new Float64Array(0),
  alive: new Uint8Array(0),
});

describe("collideBounds", () => {
  it("pushes nodes back inside the walls and above the floor", () => {
    const solid = nodes([-1, 11, 5], [5, 5, -1], [-3, 3, 4], [0, 0, -2]);
    collideBounds(solid, 10);
    expect(Array.from(solid.x)).toEqual([0, 10, 5]);
    expect(solid.y[2]).toBe(0);
    expect(solid.vx[0]).toBe(0);
    expect(solid.vx[1]).toBe(0);
    // Bounces up slightly and loses sliding speed to friction.
    expect(solid.vy[2]).toBeGreaterThan(0);
    expect(solid.vx[2]).toBeLessThan(4);
    expect(solid.vx[2]).toBeGreaterThan(0);
  });

  it("ignores nodes that left the simulation", () => {
    const solid = nodes([-1], [-1], [-3], [-2]);
    solid.nodeRefs[0] = 0;
    collideBounds(solid, 10);
    expect(solid.x[0]).toBe(-1);
  });

  it("leaves a node resting on the floor alone when it moves up", () => {
    const solid = nodes([5], [-0.1], [2], [1]);
    collideBounds(solid, 10);
    expect(solid.vx[0]).toBe(2);
    expect(solid.vy[0]).toBe(1);
  });
});

describe("stepBall", () => {
  it("bounces off the floor and both walls", () => {
    const floor = { x: 5, y: 0.1, vx: 3, vy: -5, radius: 0.25, mass: 1 };
    stepBall(floor, 10, 0.001, DEFAULT_GRAVITY);
    expect(floor.y).toBe(0.25);
    expect(floor.vy).toBeGreaterThan(0);

    const left = { x: 0.1, y: 3, vx: -5, vy: 0, radius: 0.25, mass: 1 };
    stepBall(left, 10, 0.001, DEFAULT_GRAVITY);
    expect(left.vx).toBeGreaterThan(0);

    const right = { x: 9.9, y: 3, vx: 5, vy: 0, radius: 0.25, mass: 1 };
    stepBall(right, 10, 0.001, DEFAULT_GRAVITY);
    expect(right.vx).toBeLessThan(0);
  });

  it("keeps its upward speed when it touches the floor while rising", () => {
    const ball = { x: 5, y: 0.1, vx: 0, vy: 2, radius: 0.25, mass: 1 };
    stepBall(ball, 10, 0.001, DEFAULT_GRAVITY);
    expect(ball.vy).toBeGreaterThan(0);
  });

  it("accelerates along a sideways gravity", () => {
    const ball = { x: 5, y: 3, vx: 0, vy: 0, radius: 0.25, mass: 1 };
    stepBall(ball, 10, 0.01, { x: 9.8, y: 0 });
    expect(ball.vx).toBeCloseTo(0.098);
    expect(ball.vy).toBe(0);
  });

  it("falls freely in the air", () => {
    const ball = { x: 5, y: 3, vx: 1, vy: 0, radius: 0.25, mass: 1 };
    stepBall(ball, 10, 0.01, DEFAULT_GRAVITY);
    expect(ball.vy).toBeLessThan(0);
    expect(ball.x).toBeGreaterThan(5);
  });
});

describe("applyBlast", () => {
  it("kicks nodes in range outward and skips far or detached ones", () => {
    const solid = nodes([1, 2, 1, 5], [0, 0, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    solid.nodeRefs[3] = 0;
    applyBlast(solid, 1, 0, 1.5, 10);
    // Node 0 sits on the centre, so it goes straight up.
    expect(solid.vy[0]).toBeGreaterThan(0);
    expect(solid.vx[0]).toBe(0);
    expect(solid.vx[1]).toBeGreaterThan(0);
    expect(solid.vx[2]).toBe(0);
    expect(solid.vy[2]).toBeGreaterThan(0);
    expect(solid.vx[3]).toBe(0);
  });
});
