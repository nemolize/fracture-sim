import { expect, it } from "vitest";

import { polygonMoments } from "@/sim/polygon";

import { DEFAULT_ENVIRONMENT } from "./environment";
import {
  asObjectShape,
  naturalObjectSize,
  OBJECT_SHAPES,
  objectPolygon,
} from "./object-shape";
import { validateObjectSize } from "./object-size";

const AREA = {
  rectangle: 2,
  triangle: 1,
  hexagon: 1.5,
  ellipse: 8 * Math.sin(Math.PI / 16),
};
it.each(OBJECT_SHAPES)(
  "builds a centroid-relative %s with exact selected bounds",
  (shape) => {
    expect(asObjectShape(shape)).toBe(shape);
    const polygon = objectPolygon(shape, { width: 2, height: 1 });
    const moments = polygonMoments(polygon.map(([x, y]) => ({ x, y })));
    expect(moments.area).toBeCloseTo(AREA[shape], 12);
    expect(moments.centroid.x).toBeCloseTo(0, 14);
    expect(moments.centroid.y).toBeCloseTo(0, 14);
    expect(
      Math.max(...polygon.map(([x]) => x)) -
        Math.min(...polygon.map(([x]) => x)),
    ).toBeCloseTo(2, 14);
    expect(
      Math.max(...polygon.map(([, y]) => y)) -
        Math.min(...polygon.map(([, y]) => y)),
    ).toBeCloseTo(1, 14);
  },
);
it("rejects unknown shape names", () => {
  expect(asObjectShape("unknown")).toBeUndefined();
  expect(() => objectPolygon("unknown", { width: 2, height: 1 })).toThrow(
    "Unknown object shape",
  );
});

it.each([
  { shape: "rectangle", ratio: 0.5 },
  { shape: "ellipse", ratio: 1 },
  { shape: "triangle", ratio: Math.sqrt(3) / 2 },
  { shape: "hexagon", ratio: Math.sqrt(3) / 2 },
] as const)(
  "selects natural $shape proportions within world limits",
  ({ shape, ratio }) => {
    for (const bounds of [
      DEFAULT_ENVIRONMENT,
      { width: 4, height: 3 },
      { width: 10, height: 3.8 },
      { width: 30, height: 3 },
      { width: 4, height: 20 },
    ]) {
      for (const width of [0.1, 2, 29.9]) {
        const size = naturalObjectSize(shape, width, bounds);
        expect(() => {
          validateObjectSize(size, bounds);
        }).not.toThrow();
        expect(size.height / size.width).toBeCloseTo(ratio, 12);
      }
    }
  },
);
it.each(OBJECT_SHAPES)(
  "keeps selected width for %s when natural height fits",
  (shape) => {
    expect(naturalObjectSize(shape, 2, DEFAULT_ENVIRONMENT).width).toBe(2);
  },
);
it.each(["triangle", "hexagon"] as const)(
  "gives a natural %s equal side lengths",
  (shape) => {
    const polygon = objectPolygon(
      shape,
      naturalObjectSize(shape, 2, DEFAULT_ENVIRONMENT),
    );
    const edges = polygon.map(([x, y], i) => {
      const next = polygon[(i + 1) % polygon.length];
      if (next === undefined) throw new Error("Missing vertex");
      return Math.hypot(x - next[0], y - next[1]);
    });
    expect(Math.max(...edges)).toBeCloseTo(Math.min(...edges), 12);
  },
);
it("gives a natural ellipse equal radii", () => {
  const polygon = objectPolygon(
    "ellipse",
    naturalObjectSize("ellipse", 2, DEFAULT_ENVIRONMENT),
  );
  const radii = polygon.map(([x, y]) => Math.hypot(x, y));
  expect(Math.max(...radii)).toBeCloseTo(Math.min(...radii), 12);
});
