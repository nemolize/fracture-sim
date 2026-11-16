import { describe, expect, it } from "vitest";

import { buildMesh, CELL, SCENE_NAMES } from "./scenes";

describe("buildMesh", () => {
  it.each(SCENE_NAMES)(
    "%s: every triangle is counter-clockwise and above the floor",
    (scene) => {
      const mesh = buildMesh(scene);
      for (let e = 0; e < mesh.tri.length / 3; e++) {
        const [i = 0, j = 0, k = 0] = mesh.tri.slice(3 * e, 3 * e + 3);
        const det =
          ((mesh.x[j] ?? 0) - (mesh.x[i] ?? 0)) *
            ((mesh.y[k] ?? 0) - (mesh.y[i] ?? 0)) -
          ((mesh.x[k] ?? 0) - (mesh.x[i] ?? 0)) *
            ((mesh.y[j] ?? 0) - (mesh.y[i] ?? 0));
        expect(det).toBeGreaterThan(0);
      }
      expect(Math.min(...mesh.y)).toBe(0);
    },
  );

  it("is identical for the same seed and differs for another", () => {
    expect(buildMesh("wall", 3)).toEqual(buildMesh("wall", 3));
    expect(buildMesh("wall", 3).x).not.toEqual(buildMesh("wall", 4).x);
  });

  it("keeps the boundary on the grid so the body stays rectangular", () => {
    const mesh = buildMesh("wall");
    expect(Math.min(...mesh.x)).toBeCloseTo(3, 12);
    expect(Math.max(...mesh.x)).toBeCloseTo(7, 12);
    expect(Math.max(...mesh.y)).toBeCloseTo(2, 12);
    expect(CELL).toBe(0.1);
  });
});
