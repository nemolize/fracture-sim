import { at as atF64, atF32, atInt, atU32 } from "@/sim/array";
import { type Ball } from "@/sim/contact";
import { type Material, VISCOSITY_PER_YOUNGS } from "@/sim/materials";
import { restShape } from "@/sim/rest";
import type { Mesh } from "@/sim/scenes";

/** Threads per workgroup in every compute shader. */
export const WORKGROUP_SIZE = 64;

/** Workgroups needed to cover `items` threads. */
export const dispatchCount = (items: number): number =>
  Math.ceil(items / WORKGROUP_SIZE);

/** 32-bit words in one `Node`, `ElemStatic`, `ElemState` and `Ball` record. */
export const RECORD_WORDS = 8;
export const RECORD_BYTES = 4 * RECORD_WORDS;

/** Largest finite f32; stands in for the infinite yield stress of a purely elastic material. */
const F32_MAX = 3.4e38;

/** An ArrayBuffer seen both as f32 and u32 words. */
interface Words {
  buffer: ArrayBuffer;
  f32: Float32Array;
  u32: Uint32Array;
}

const words = (count: number): Words => {
  const buffer = new ArrayBuffer(4 * count);
  return {
    buffer,
    f32: new Float32Array(buffer),
    u32: new Uint32Array(buffer),
  };
};

export interface PackedMesh {
  nodeCount: number;
  triCount: number;
  /** `Node` records: position, velocity, grab offset, grab flag, live-triangle count. */
  nodes: ArrayBuffer;
  /** `ElemStatic` records: rest inverse, node indices, rest area. */
  elemStatic: ArrayBuffer;
  /** `ElemState` records: inverse plastic gradient, plastic strain, damage, stress ratio, alive. */
  elemState: ArrayBuffer;
  /** Node `n` owns the entries `adjacency[adjacency[n] .. adjacency[n + 1])`, each `3 * triangle + corner`. */
  adjacency: ArrayBuffer;
  tri: Int32Array;
}

const packAdjacency = (
  tri: Int32Array,
  nodeCount: number,
): Uint32Array<ArrayBuffer> => {
  const counts = new Uint32Array(nodeCount);
  for (const node of tri) counts[node] = atU32(counts, node) + 1;
  const adjacency = new Uint32Array(nodeCount + 1 + tri.length);
  let offset = nodeCount + 1;
  for (let n = 0; n < nodeCount; n++) {
    adjacency[n] = offset;
    offset += atU32(counts, n);
  }
  adjacency[nodeCount] = offset;
  const next = adjacency.slice(0, nodeCount);
  for (let slot = 0; slot < tri.length; slot++) {
    const node = atInt(tri, slot);
    adjacency[atU32(next, node)] = slot;
    next[node] = atU32(next, node) + 1;
  }
  return adjacency;
};

export const packMesh = (mesh: Mesh): PackedMesh => {
  const nodeCount = mesh.x.length;
  const triCount = mesh.tri.length / 3;
  const adjacency = packAdjacency(mesh.tri, nodeCount);

  const nodes = words(RECORD_WORDS * nodeCount);
  for (let n = 0; n < nodeCount; n++) {
    nodes.f32[RECORD_WORDS * n] = atF64(mesh.x, n);
    nodes.f32[RECORD_WORDS * n + 1] = atF64(mesh.y, n);
    nodes.u32[RECORD_WORDS * n + 7] =
      atU32(adjacency, n + 1) - atU32(adjacency, n);
  }

  const rest = restShape(mesh);
  const elemStatic = words(RECORD_WORDS * triCount);
  const elemState = words(RECORD_WORDS * triCount);
  for (let e = 0; e < triCount; e++) {
    const base = RECORD_WORDS * e;
    for (let c = 0; c < 4; c++) {
      elemStatic.f32[base + c] = atF64(rest.inverse, 4 * e + c);
    }
    for (let c = 0; c < 3; c++) {
      elemStatic.u32[base + 4 + c] = atInt(mesh.tri, 3 * e + c);
    }
    elemStatic.f32[base + 7] = atF64(rest.area, e);
    elemState.f32.set([1, 0, 0, 1], base);
    elemState.u32[base + 7] = 1;
  }

  return {
    nodeCount,
    triCount,
    nodes: nodes.buffer,
    elemStatic: elemStatic.buffer,
    elemState: elemState.buffer,
    adjacency: adjacency.buffer,
    tri: mesh.tri,
  };
};

/** One `Ball` record: position, velocity, radius, mass. */
export const packBall = (ball: Ball): Float32Array<ArrayBuffer> =>
  Float32Array.of(
    ball.x,
    ball.y,
    ball.vx,
    ball.vy,
    ball.radius,
    ball.mass,
    0,
    0,
  );

/** The `Material` uniform: derived Lamé constants first, then the failure parameters. */
export const packMaterial = (material: Material): Float32Array<ArrayBuffer> => {
  const mu = material.youngs / (2 * (1 + material.poisson));
  const lambda =
    (material.youngs * material.poisson) /
    ((1 + material.poisson) * (1 - 2 * material.poisson));
  return Float32Array.of(
    mu,
    lambda,
    VISCOSITY_PER_YOUNGS * material.youngs,
    Math.min(material.yieldStress, F32_MAX),
    material.hardening,
    material.strength,
    material.damageRate,
    material.plasticDamage,
    material.density,
    0,
    0,
    0,
  );
};

/** The per-node fields of a `Node` readback. */
export interface NodeFields {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  nodeRefs: Uint32Array;
}

export const unpackNodes = (
  buffer: ArrayBuffer,
  nodeCount: number,
): NodeFields => {
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  const fields: NodeFields = {
    x: new Float32Array(nodeCount),
    y: new Float32Array(nodeCount),
    vx: new Float32Array(nodeCount),
    vy: new Float32Array(nodeCount),
    nodeRefs: new Uint32Array(nodeCount),
  };
  for (let n = 0; n < nodeCount; n++) {
    const base = RECORD_WORDS * n;
    fields.x[n] = atF32(f32, base);
    fields.y[n] = atF32(f32, base + 1);
    fields.vx[n] = atF32(f32, base + 2);
    fields.vy[n] = atF32(f32, base + 3);
    fields.nodeRefs[n] = atU32(u32, base + 7);
  }
  return fields;
};
