import { describe, expect, it } from "vitest";

import { RESOLUTION_NAMES, RESOLUTIONS, timeStep } from "./resolution";
import { buildMesh, CELL, SCENE_NAMES } from "./scenes";

describe("RESOLUTIONS", () => {
  it("offers at least three levels, including today's cell size", () => {
    expect(RESOLUTION_NAMES.length).toBeGreaterThanOrEqual(3);
    expect(RESOLUTIONS.standard.cell).toBe(CELL);
  });

  it.each(SCENE_NAMES)(
    "%s: the finest level has at least 10x the standard triangle count",
    (scene) => {
      const count = (cell: number) => buildMesh(scene, 1, cell).tri.length / 3;
      expect(
        count(RESOLUTIONS.finest.cell) / count(RESOLUTIONS.standard.cell),
      ).toBeGreaterThanOrEqual(10);
    },
  );

  it("lists the levels from coarse to fine", () => {
    const cells = RESOLUTION_NAMES.map((name) => RESOLUTIONS[name].cell);
    expect(cells).toEqual([...cells].sort((a, b) => b - a));
  });
});

describe("timeStep", () => {
  it("keeps the standard mesh's step", () => {
    expect(timeStep(CELL)).toBe(0.0003);
  });

  it("shrinks in proportion to the cell size", () => {
    expect(timeStep(CELL / 2)).toBeCloseTo(timeStep(CELL) / 2, 15);
    expect(timeStep(RESOLUTIONS.finest.cell)).toBeLessThan(
      timeStep(RESOLUTIONS.fine.cell),
    );
  });
});
