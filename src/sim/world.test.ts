import { describe, expect, it } from "vitest";

import { at } from "./array";
import { World } from "./world";

const run = (world: World, steps: number): void => {
  for (let s = 0; s < steps; s++) world.step();
};

const maxSpeed = (world: World): number => {
  let fastest = 0;
  for (let n = 0; n < world.nodeCount; n++) {
    fastest = Math.max(fastest, Math.hypot(at(world.vx, n), at(world.vy, n)));
  }
  return fastest;
};

describe("World", () => {
  it("settles under gravity without breaking", () => {
    const world = new World({ scene: "wall", material: "concrete" });
    run(world, 1500);
    expect(world.stats().erodedFraction).toBe(0);
    expect(maxSpeed(world)).toBeLessThan(0.5);
    expect(Number.isFinite(at(world.x, 5))).toBe(true);
  });

  it("slides toward the side gravity points to", () => {
    const world = new World({ scene: "wall", material: "concrete" });
    run(world, 1500);
    const centre = (): number => at(world.x, 5);
    const before = centre();
    world.setGravity(9.8, 0);
    run(world, 300);
    expect(world.gravity).toEqual({ x: 9.8, y: 0 });
    expect(centre()).toBeGreaterThan(before);
  });

  it("is deterministic for a given seed", () => {
    const a = new World({ scene: "tower", material: "steel", seed: 7 });
    const b = new World({ scene: "tower", material: "steel", seed: 7 });
    run(a, 200);
    run(b, 200);
    expect(a.x).toEqual(b.x);
  });

  it("conserves momentum between the ball and the body in a contact", () => {
    const world = new World({ scene: "wall", material: "steel" });
    world.throwBall(2.5, 1, 5, 0);
    const ball = world.balls[0];
    if (ball === undefined) throw new Error("ball missing");
    const before = ball.mass * ball.vx;
    run(world, 600);
    let total = ball.mass * ball.vx;
    for (let n = 0; n < world.nodeCount; n++) {
      total += at(world.mass, n) * at(world.vx, n);
    }
    expect(ball.vx).toBeLessThan(4);
    expect(total).toBeCloseTo(before, -1);
  });

  it("shatters glass hit by a fast ball into several pieces", () => {
    const world = new World({ scene: "wall", material: "glass" });
    run(world, 1500);
    world.throwBall(1, 1.2, 14, 0);
    run(world, 6000);
    world.refreshChunks();
    const stats = world.stats();
    expect(stats.erodedFraction).toBeGreaterThan(0.2);
    expect(stats.chunks).toBeGreaterThan(1);
    expect(stats.maxPlasticStrain).toBe(0);
  });

  it("lets steel deform plastically rather than shatter", () => {
    const world = new World({ scene: "wall", material: "steel" });
    run(world, 1500);
    world.throwBall(1, 1.2, 8, 0);
    run(world, 6000);
    const stats = world.stats();
    expect(stats.maxPlasticStrain).toBeGreaterThan(0.05);
    expect(stats.erodedFraction).toBeLessThan(0.4);
  });

  it("keeps balls inside the world", () => {
    const world = new World({ scene: "tower", material: "clay" });
    world.throwBall(9.9, 3, 20, 0);
    world.throwBall(0.1, 3, -20, 0);
    world.throwBall(5, 0.1, 0, -20);
    run(world, 50);
    for (const ball of world.balls) {
      expect(ball.x).toBeGreaterThanOrEqual(ball.radius);
      expect(ball.x).toBeLessThanOrEqual(world.width - ball.radius);
      expect(ball.y).toBeGreaterThanOrEqual(ball.radius);
    }
  });

  it("survives a triangle squashed flat while yielding", () => {
    const world = new World({ scene: "tower", material: "steel" });
    const [i = 0, j = 0, k = 0] = world.tri.slice(0, 3);
    world.x[j] = at(world.x, i) + 0.3;
    world.y[j] = at(world.y, i);
    world.x[k] = at(world.x, i) + 0.15;
    world.y[k] = at(world.y, i);
    world.step();
    expect(at(world.plasticStrain, 0)).toBeGreaterThan(0);
    expect(
      Array.from(world.plasticInverse.slice(0, 4)).every(Number.isFinite),
    ).toBe(true);
  });

  it("drops the oldest ball past the limit", () => {
    const world = new World({ scene: "wall", material: "glass" });
    for (let i = 0; i < 10; i++) world.throwBall(i * 0.5, 4, 0, 0);
    expect(world.balls).toHaveLength(8);
    expect(world.balls[0]?.x).toBe(1);
  });

  it("blast pushes nearby nodes away from the centre", () => {
    const world = new World({ scene: "wall", material: "concrete" });
    world.blast(5, 1);
    let left = 0;
    let right = 0;
    for (let n = 0; n < world.nodeCount; n++) {
      if (at(world.x, n) < 4.5) left += at(world.vx, n);
      if (at(world.x, n) > 5.5) right += at(world.vx, n);
    }
    expect(left).toBeLessThan(0);
    expect(right).toBeGreaterThan(0);
  });

  it("grab drags the body toward the pointer and releases cleanly", () => {
    const world = new World({ scene: "wall", material: "clay" });
    expect(world.startGrab(0.5, 4)).toBe(false);
    expect(world.grabbing).toBe(false);
    expect(world.startGrab(5, 1)).toBe(true);
    expect(world.grabbing).toBe(true);
    world.moveGrab(5, 3);
    run(world, 300);
    expect(world.stats().maxPlasticStrain).toBeGreaterThan(0);
    world.endGrab();
    world.moveGrab(0, 0);
    expect(world.grabbing).toBe(false);
  });

  it("advances the clock by the fixed step", () => {
    const world = new World({ scene: "wall", material: "glass" });
    run(world, 10);
    expect(world.time).toBeCloseTo(10 * world.dt, 12);
  });

  it("uses the time step of its mesh resolution", () => {
    const fine = new World({ scene: "tower", material: "glass", cell: 0.05 });
    const standard = new World({ scene: "tower", material: "glass" });
    expect(fine.dt).toBeCloseTo(standard.dt / 2, 15);
    expect(fine.triCount).toBe(4 * standard.triCount);
  });
});
