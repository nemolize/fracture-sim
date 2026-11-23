/* eslint-disable @typescript-eslint/dot-notation -- Inspect actual collision vertices and physical mass properties. */
import RAPIER from "@dimforge/rapier2d-compat";
import { afterEach, beforeAll, expect, it } from "vitest";

import { DEFAULT_FLOOR_MATERIAL } from "@/sim/floor-material";
import { DEFAULT_MATERIAL } from "@/sim/material";
import { polygonMoments } from "@/sim/polygon";
import type { Vec2 } from "@/sim/vec2";

import { DEFAULT_ENVIRONMENT } from "./environment";
import { OBJECT_SHAPES, objectPolygon } from "./object-shape";
import { initializePhysics, RigidWorld } from "./world";

beforeAll(initializePhysics);
let world: RigidWorld | undefined;
afterEach(() => {
  world?.dispose();
  world = undefined;
});
const vertices = (shape: RAPIER.Shape): Vec2[] => {
  if (shape instanceof RAPIER.ConvexPolygon)
    return Array.from({ length: shape.vertices.length / 2 }, (_, i) => ({
      x: shape.vertices[i * 2] ?? NaN,
      y: shape.vertices[i * 2 + 1] ?? NaN,
    }));
  if (shape instanceof RAPIER.Triangle) return [shape.a, shape.b, shape.c];
  if (shape instanceof RAPIER.Compound)
    return shape.shapes.flatMap((part, index) => {
      const position = shape.positions[index];
      const angle = shape.rotations[index];
      if (position === undefined || angle === undefined)
        throw new Error("Missing compound transform");
      return vertices(part).map(({ x, y }) => ({
        x: position.x + Math.cos(angle) * x - Math.sin(angle) * y,
        y: position.y + Math.sin(angle) * x + Math.cos(angle) * y,
      }));
    });
  throw new Error("Unexpected collider shape");
};
for (const shape of OBJECT_SHAPES) {
  it.each([
    { width: 29.9, height: 0.1 },
    { width: 0.1, height: 19.9 },
    { width: 9.9, height: 0.1 },
    { width: 1, height: 0.1 },
    { width: 29.9, height: 19.9 },
  ])(
    `preserves actual ${shape} collision geometry at $width × $height`,
    (size) => {
      world = new RigidWorld(
        "plate",
        { ...DEFAULT_ENVIRONMENT, width: 30, height: 20 },
        size,
        shape,
      );
      const body = world["shapes"][4]?.body;
      if (body === undefined) throw new Error("Missing object");
      const polygon = objectPolygon(shape, size).map(([x, y]) => ({ x, y }));
      const moments = polygonMoments(polygon);
      const mass = moments.area * 25;
      expect(body.mass() / mass).toBeCloseTo(1, 5);
      expect(
        body.principalInertia() / (moments.polarAreaMoment * 25),
      ).toBeCloseTo(1, 5);
      const key = ({ x, y }: Vec2) =>
        `${String(Math.fround(x))},${String(Math.fround(y))}`;
      expect(new Set(vertices(body.collider(0).shape).map(key))).toEqual(
        new Set(polygon.map(key)),
      );
      const pos = body.translation(),
        angle = body.rotation();
      for (const point of polygon) {
        const x = point.x * 0.999,
          y = point.y * 0.999;
        expect(
          body.collider(0).containsPoint({
            x: pos.x + Math.cos(angle) * x - Math.sin(angle) * y,
            y: pos.y + Math.sin(angle) * x + Math.cos(angle) * y,
          }),
        ).toBe(true);
      }
      for (let i = 0; i < 120; i++) world.advance(1 / 60, { x: 0, y: -9.8 });
      expect(world.snapshot().stats.bodies).toBe(1);
      expect(world.snapshot().stats.mass).toBeCloseTo(mass, 7);
    },
  );
}
it.each(["ellipse", "triangle", "hexagon"] as const)(
  "slides a thin %s without catching internal fan edges",
  (shape) => {
    world = new RigidWorld(
      "plate",
      { ...DEFAULT_ENVIRONMENT, width: 30, height: 20 },
      { width: 9.9, height: 0.1 },
      shape,
      {
        floor: { ...DEFAULT_FLOOR_MATERIAL, friction: 0 },
        object: { ...DEFAULT_MATERIAL, friction: 0 },
      },
    );
    world["shapes"][4]?.body.setLinvel({ x: 0.5, y: 0 }, true);
    for (let i = 0; i < 120; i++) world.advance(1 / 60, { x: 0, y: -9.8 });
    expect(world.snapshot().stats.bodies).toBe(1);
    expect(world.snapshot().poses[16]).toBeGreaterThan(15.8);
  },
);
it.each(["ellipse", "triangle", "hexagon"] as const)(
  "fractures a thin %s without gaining mass",
  (shape) => {
    world = new RigidWorld(
      "plate",
      { ...DEFAULT_ENVIRONMENT, width: 30, height: 20 },
      { width: 9.9, height: 0.1 },
      shape,
    );
    const body = world["shapes"][4]?.body;
    if (body === undefined) throw new Error("Missing object");
    const before = world.snapshot().stats.mass,
      pos = body.translation();
    body.setTranslation({ x: pos.x, y: pos.y + 0.15 }, true);
    for (let i = 0; i < 120; i++) world.advance(1 / 60, { x: 0, y: -9.8 });
    expect(world.snapshot().stats.bodies).toBeGreaterThan(1);
    expect(world.snapshot().stats.mass).toBeLessThanOrEqual(before + 1e-8);
    expect(world.snapshot().poses.every(Number.isFinite)).toBe(true);
  },
);
