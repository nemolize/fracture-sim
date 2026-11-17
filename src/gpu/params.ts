/** Mirror of the `Params` uniform in `common.wgsl`; field order is its memory layout. */
export interface SolverParams {
  dt: number;
  drag: number;
  width: number;
  ballCount: number;
  nodeCount: number;
  triCount: number;
  grabActive: boolean;
  blastRadius: number;
  grabTarget: { x: number; y: number };
  blastCenter: { x: number; y: number };
  blastSpeed: number;
}

/** Bytes the uniform buffer needs: the struct is 56 bytes, rounded up to 16. */
export const PARAMS_BYTES = 64;

export const encodeParams = (params: SolverParams): ArrayBuffer => {
  const buffer = new ArrayBuffer(PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setFloat32(0, params.dt, true);
  view.setFloat32(4, params.drag, true);
  view.setFloat32(8, params.width, true);
  view.setUint32(12, params.ballCount, true);
  view.setUint32(16, params.nodeCount, true);
  view.setUint32(20, params.triCount, true);
  view.setUint32(24, params.grabActive ? 1 : 0, true);
  view.setFloat32(28, params.blastRadius, true);
  view.setFloat32(32, params.grabTarget.x, true);
  view.setFloat32(36, params.grabTarget.y, true);
  view.setFloat32(40, params.blastCenter.x, true);
  view.setFloat32(44, params.blastCenter.y, true);
  view.setFloat32(48, params.blastSpeed, true);
  return buffer;
};
