import { expect, it } from "vitest";

import { polygonMoments } from "@/sim/polygon";

import { asObjectShape, OBJECT_SHAPES, objectPolygon } from "./object-shape";

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
