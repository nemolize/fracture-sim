import { atByte, atInt } from "./array";
import { labelChunks } from "./chunks";

export interface Metrics {
  erodedFraction: number;
  chunks: number;
  maxPlasticStrain: number;
  /** Rest-area-weighted mean of the live triangles' centroids. */
  centreOfMass: { x: number; y: number };
}

/** The scalar summary the CPU reference and the GPU solver are compared on. */
export const summarise = (state: {
  tri: Int32Array;
  restArea: ArrayLike<number>;
  nodeCount: number;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  alive: Uint8Array;
  plasticStrain: ArrayLike<number>;
}): Metrics => {
  const triCount = state.alive.length;
  const labels = new Int32Array(triCount);
  const chunks = labelChunks(state.tri, state.alive, state.nodeCount, labels);
  let eroded = 0;
  let maxPlasticStrain = 0;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let e = 0; e < triCount; e++) {
    maxPlasticStrain = Math.max(maxPlasticStrain, state.plasticStrain[e] ?? 0);
    if (atByte(state.alive, e) === 0) {
      eroded++;
      continue;
    }
    const weight = state.restArea[e] ?? 0;
    for (let k = 0; k < 3; k++) {
      const n = atInt(state.tri, 3 * e + k);
      cx += (weight * (state.x[n] ?? 0)) / 3;
      cy += (weight * (state.y[n] ?? 0)) / 3;
    }
    area += weight;
  }
  return {
    erodedFraction: eroded / triCount,
    chunks,
    maxPlasticStrain,
    centreOfMass: { x: cx / area, y: cy / area },
  };
};
