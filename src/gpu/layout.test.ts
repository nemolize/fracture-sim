import { describe, expect, it } from "vitest";

import { MATERIALS } from "@/sim/materials";
import { VISCOSITY_PER_YOUNGS } from "@/sim/materials";

import {
  dispatchCount,
  packBall,
  packMaterial,
  packMesh,
  RECORD_BYTES,
  RECORD_WORDS,
  unpackBalls,
  unpackNodes,
  WORKGROUP_SIZE,
} from "./layout";

// Two triangles on a 2 x 4 rectangle: (0,0)-(2,0)-(0,4) and (2,0)-(2,4)-(0,4).
const mesh = {
  x: Float64Array.of(0, 2, 0, 2),
  y: Float64Array.of(0, 0, 4, 4),
  tri: Int32Array.of(0, 1, 2, 1, 3, 2),
};

describe("dispatchCount", () => {
  it.each([
    [0, 0],
    [1, 1],
    [WORKGROUP_SIZE, 1],
    [WORKGROUP_SIZE + 1, 2],
  ])("covers %s threads with %s workgroups", (items, groups) => {
    expect(dispatchCount(items)).toBe(groups);
  });
});

describe("packMesh", () => {
  const packed = packMesh(mesh);

  it("sizes every record array", () => {
    expect(packed.nodeCount).toBe(4);
    expect(packed.triCount).toBe(2);
    expect(packed.nodes.byteLength).toBe(4 * RECORD_BYTES);
    expect(packed.elemStatic.byteLength).toBe(2 * RECORD_BYTES);
    expect(packed.elemState.byteLength).toBe(2 * RECORD_BYTES);
  });

  it("stores node positions and the number of triangles touching each node", () => {
    const f32 = new Float32Array(packed.nodes);
    const u32 = new Uint32Array(packed.nodes);
    expect(f32[RECORD_WORDS * 3]).toBe(2);
    expect(f32[RECORD_WORDS * 3 + 1]).toBe(4);
    expect([0, 1, 2, 3].map((n) => u32[RECORD_WORDS * n + 7])).toEqual([
      1, 2, 2, 1,
    ]);
  });

  it("stores each triangle's rest inverse, node indices and area", () => {
    const f32 = new Float32Array(packed.elemStatic);
    const u32 = new Uint32Array(packed.elemStatic);
    expect(Array.from(f32.slice(0, 4)).map(Math.abs)).toEqual([
      0.5, 0, 0, 0.25,
    ]);
    expect(Array.from(u32.slice(4, 7))).toEqual([0, 1, 2]);
    expect(f32[7]).toBe(4);
    expect(Array.from(u32.slice(RECORD_WORDS + 4, RECORD_WORDS + 7))).toEqual([
      1, 3, 2,
    ]);
  });

  it("starts every triangle alive with no plastic deformation", () => {
    const f32 = new Float32Array(packed.elemState);
    const u32 = new Uint32Array(packed.elemState);
    expect(
      Array.from(f32.slice(0, 8).map((v, i) => (i === 7 ? 0 : v))),
    ).toEqual([1, 0, 0, 1, 0, 0, 0, 0]);
    expect(u32[7]).toBe(1);
    expect(u32[RECORD_WORDS + 7]).toBe(1);
  });

  it("lists, for each node, the triangle corners that touch it", () => {
    const adjacency = new Uint32Array(packed.adjacency);
    const entries = (node: number) =>
      Array.from(
        adjacency.slice(adjacency[node] ?? 0, adjacency[node + 1] ?? 0),
      ).sort((a, b) => a - b);
    // The entry is 3 * triangle + corner.
    expect(entries(0)).toEqual([0]);
    expect(entries(1)).toEqual([1, 3]);
    expect(entries(2)).toEqual([2, 5]);
    expect(entries(3)).toEqual([4]);
    expect(adjacency[4]).toBe(adjacency.length);
  });
});

describe("unpackNodes", () => {
  it("reads back what packMesh wrote", () => {
    const fields = unpackNodes(packMesh(mesh).nodes, 4);
    expect(Array.from(fields.x)).toEqual([0, 2, 0, 2]);
    expect(Array.from(fields.y)).toEqual([0, 0, 4, 4]);
    expect(Array.from(fields.vx)).toEqual([0, 0, 0, 0]);
    expect(Array.from(fields.nodeRefs)).toEqual([1, 2, 2, 1]);
  });
});

describe("packBall", () => {
  it("lays out position, velocity, radius and mass", () => {
    expect(
      Array.from(packBall({ x: 1, y: 2, vx: 3, vy: 4, radius: 0.25, mass: 2 })),
    ).toEqual([1, 2, 3, 4, 0.25, 2, 0, 0]);
  });
});

describe("packMaterial", () => {
  it("derives the Lamé constants and the viscosity", () => {
    const m = MATERIALS.glass;
    const packed = packMaterial(m);
    expect(packed[0]).toBeCloseTo(m.youngs / (2 * (1 + m.poisson)), 3);
    expect(packed[1]).toBeCloseTo(
      (m.youngs * m.poisson) / ((1 + m.poisson) * (1 - 2 * m.poisson)),
      3,
    );
    expect(packed[2]).toBeCloseTo(VISCOSITY_PER_YOUNGS * m.youngs, 5);
    expect(packed[5]).toBe(m.strength);
    expect(packed[8]).toBe(m.density);
  });

  it("replaces an infinite yield stress with a finite one", () => {
    expect(packMaterial(MATERIALS.glass)[3]).toBeLessThan(Infinity);
    expect(packMaterial(MATERIALS.glass)[3]).toBeGreaterThan(1e30);
    expect(packMaterial(MATERIALS.steel)[3]).toBe(MATERIALS.steel.yieldStress);
  });
});

describe("unpackBalls", () => {
  it("reads the first records back at the packed stride", () => {
    const first = { x: 1, y: 2, vx: 3, vy: 4, radius: 0.25, mass: 2 };
    const second = { x: 5, y: 6, vx: 7, vy: 8, radius: 0.25, mass: 2 };
    const bytes = new Float32Array(3 * RECORD_WORDS);
    bytes.set(packBall(first), 0);
    bytes.set(packBall(second), RECORD_WORDS);
    expect(unpackBalls(bytes.buffer, 2)).toEqual([first, second]);
  });
});
