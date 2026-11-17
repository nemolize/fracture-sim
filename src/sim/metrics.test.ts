import { expect, it } from "vitest";

import { summarise } from "./metrics";

// Two triangles on the unit square, split along the diagonal.
const square = {
  tri: Int32Array.of(0, 1, 2, 1, 3, 2),
  restArea: [0.5, 0.5],
  nodeCount: 4,
  x: [0, 1, 0, 1],
  y: [0, 0, 1, 1],
  plasticStrain: [0.25, 0.5],
};

it("summarises a whole body", () => {
  const metrics = summarise({ ...square, alive: Uint8Array.of(1, 1) });
  expect(metrics.erodedFraction).toBe(0);
  expect(metrics.chunks).toBe(1);
  expect(metrics.maxPlasticStrain).toBe(0.5);
  expect(metrics.centreOfMass.x).toBeCloseTo(0.5, 12);
  expect(metrics.centreOfMass.y).toBeCloseTo(0.5, 12);
});

it("leaves eroded triangles out of the centre of mass", () => {
  const metrics = summarise({ ...square, alive: Uint8Array.of(1, 0) });
  expect(metrics.erodedFraction).toBe(0.5);
  expect(metrics.centreOfMass.x).toBeCloseTo(1 / 3, 12);
  expect(metrics.centreOfMass.y).toBeCloseTo(1 / 3, 12);
});

it("reads missing entries as zero", () => {
  const metrics = summarise({
    tri: Int32Array.of(0, 1, 2),
    restArea: [],
    nodeCount: 3,
    x: [],
    y: [],
    alive: Uint8Array.of(1),
    plasticStrain: [],
  });
  expect(metrics.maxPlasticStrain).toBe(0);
  expect(Number.isNaN(metrics.centreOfMass.x)).toBe(true);
});
