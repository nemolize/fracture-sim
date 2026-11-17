import { at, atInt } from "./array";
import type { Mesh } from "./scenes";

/** Reference-shape quantities of every triangle, shared by the CPU reference and the GPU upload. */
export interface RestShape {
  /** Inverse of the rest-shape edge matrix, row-major 2x2 per triangle. */
  inverse: Float64Array;
  /** Rest area per triangle. */
  area: Float64Array;
}

export const restShape = (mesh: Mesh): RestShape => {
  const triCount = mesh.tri.length / 3;
  const inverse = new Float64Array(4 * triCount);
  const area = new Float64Array(triCount);
  for (let e = 0; e < triCount; e++) {
    const i = atInt(mesh.tri, 3 * e);
    const j = atInt(mesh.tri, 3 * e + 1);
    const k = atInt(mesh.tri, 3 * e + 2);
    const d00 = at(mesh.x, j) - at(mesh.x, i);
    const d10 = at(mesh.y, j) - at(mesh.y, i);
    const d01 = at(mesh.x, k) - at(mesh.x, i);
    const d11 = at(mesh.y, k) - at(mesh.y, i);
    const det = d00 * d11 - d01 * d10;
    inverse.set([d11 / det, -d01 / det, -d10 / det, d00 / det], 4 * e);
    area[e] = Math.abs(det) / 2;
  }
  return { inverse, area };
};
