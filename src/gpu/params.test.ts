import { expect, it } from "vitest";

import { encodeParams, PARAMS_BYTES, type SolverParams } from "./params";

const params: SolverParams = {
  dt: 0.5,
  drag: 0.25,
  width: 10,
  ballCount: 3,
  nodeCount: 861,
  triCount: 1600,
  grabActive: true,
  blastRadius: 1.5,
  grabTarget: { x: 2, y: 4 },
  blastCenter: { x: 6, y: 8 },
  blastSpeed: 30,
  gravity: { x: 1.5, y: -9.5 },
};

it("writes every field at the offset the WGSL struct reads it from", () => {
  const buffer = encodeParams(params);
  const view = new DataView(buffer);
  expect(buffer.byteLength).toBe(PARAMS_BYTES);
  expect(view.getFloat32(0, true)).toBe(0.5);
  expect(view.getFloat32(4, true)).toBe(0.25);
  expect(view.getFloat32(8, true)).toBe(10);
  expect(view.getUint32(12, true)).toBe(3);
  expect(view.getUint32(16, true)).toBe(861);
  expect(view.getUint32(20, true)).toBe(1600);
  expect(view.getUint32(24, true)).toBe(1);
  expect(view.getFloat32(28, true)).toBe(1.5);
  expect(view.getFloat32(32, true)).toBe(2);
  expect(view.getFloat32(36, true)).toBe(4);
  expect(view.getFloat32(40, true)).toBe(6);
  expect(view.getFloat32(44, true)).toBe(8);
  expect(view.getFloat32(48, true)).toBe(30);
  expect(view.getFloat32(56, true)).toBe(1.5);
  expect(view.getFloat32(60, true)).toBe(-9.5);
});

it("writes an inactive grab as 0", () => {
  const view = new DataView(encodeParams({ ...params, grabActive: false }));
  expect(view.getUint32(24, true)).toBe(0);
});
