import { expect, it } from "vitest";

import type { CrushProperties } from "./contact-stress";
import {
  crushSegment,
  crushStress,
  reloadModulus,
  segmentStiffness,
} from "./crush";

const foam: CrushProperties = {
  plateauStressPa: 100e3,
  densificationStrain: 0.6,
  densifiedModulusPa: 10e6,
  crushDepthM: 0.02,
};
const E0 = 2e6;
const AREA = 0.01;
const DEPTH = 0.02;

it("crushes a fresh segment to a permanent strain and counts the work it spent for good", () => {
  const { p, dissipated } = crushSegment(0, 4.5, foam, E0, AREA, DEPTH);
  expect(p).toBeCloseTo(0.2, 9);
  expect(dissipated).toBeCloseTo(4, 9);
});

it("makes a crushed segment stiffer than a fresh one, and stays put under an elastic hit", () => {
  const { p } = crushSegment(0, 4.5, foam, E0, AREA, DEPTH);
  expect(segmentStiffness(0, foam, E0, AREA, DEPTH)).toBeCloseTo(1e6, 3);
  expect(segmentStiffness(p, foam, E0, AREA, DEPTH)).toBeCloseTo(2.4545e6, -2);
  const again = crushSegment(p, 0.05, foam, E0, AREA, DEPTH);
  expect(again).toEqual({ p, dissipated: 0 });
  expect(crushSegment(0, 0.05, foam, E0, AREA, DEPTH)).toEqual({
    p: 0,
    dissipated: 0,
  });
});

it("hardens once the segment is crushed past the densification point", () => {
  const start = foam.densificationStrain - foam.plateauStressPa / E0;
  expect(crushStress(start, foam, E0)).toBe(foam.plateauStressPa);
  expect(crushStress(start + 0.1, foam, E0)).toBeCloseTo(
    foam.plateauStressPa + foam.densifiedModulusPa * 0.1,
    6,
  );
  expect(reloadModulus(start, foam, E0)).toBe(foam.densifiedModulusPa);
  expect(reloadModulus(start + 0.1, foam, E0)).toBe(foam.densifiedModulusPa);
  const { p } = crushSegment(0.3, 100, foam, E0, AREA, DEPTH);
  expect(p).toBeGreaterThan(start);
  expect(p).toBeLessThanOrEqual(0.95);
});

it("stops at the compression limit however much work arrives", () => {
  expect(crushSegment(0, 1e9, foam, E0, AREA, DEPTH).p).toBe(0.95);
});
