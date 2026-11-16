/** Per-node and per-triangle arrays shared by the solver and the contact code. */
export interface Solid {
  nodeCount: number;
  triCount: number;
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  fx: Float64Array;
  fy: Float64Array;
  mass: Float64Array;
  /** Live triangles touching each node; 0 means the node has left the simulation. */
  nodeRefs: Int32Array;
  /** Three node indices per triangle. */
  tri: Int32Array;
  /** Inverse of the rest-shape edge matrix, row-major 2x2 per triangle. */
  restInverse: Float64Array;
  /** Inverse of the accumulated plastic deformation gradient, row-major 2x2 per triangle. */
  plasticInverse: Float64Array;
  restArea: Float64Array;
  plasticStrain: Float64Array;
  damage: Float64Array;
  /** Largest tensile stress of the last step over the material strength. */
  stressRatio: Float64Array;
  alive: Uint8Array;
}
