export type SceneName = "wall" | "tower";

export const SCENE_NAMES: readonly SceneName[] = ["wall", "tower"];

/** World width in metres; the floor is y = 0 and +y is up. */
export const WORLD_WIDTH = 10;

const SCENE_SIZE: Record<
  SceneName,
  { x0: number; width: number; height: number }
> = {
  wall: { x0: 3, width: 4, height: 2 },
  tower: { x0: 4.5, width: 1, height: 3.5 },
};

/** Cell size of the default mesh; finer levels are listed in `resolution.ts`. */
export const CELL = 0.1;

export interface Mesh {
  x: Float64Array;
  y: Float64Array;
  /** Three node indices per triangle. */
  tri: Int32Array;
}

/** Small deterministic PRNG so a scene is identical on every reset and in tests. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * A rectangle of triangles standing on the floor. Interior nodes are jittered
 * and each cell's diagonal is random, so cracks are not locked to a lattice.
 */
export const buildMesh = (scene: SceneName, seed = 1, cell = CELL): Mesh => {
  const { x0, width, height } = SCENE_SIZE[scene];
  const nx = Math.round(width / cell);
  const ny = Math.round(height / cell);
  const random = mulberry32(seed);
  const stride = nx + 1;
  const x = new Float64Array(stride * (ny + 1));
  const y = new Float64Array(stride * (ny + 1));
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const interior = i > 0 && i < nx && j > 0 && j < ny;
      const jitter = interior ? 0.12 * cell : 0;
      x[j * stride + i] = x0 + i * cell + (random() - 0.5) * 2 * jitter;
      y[j * stride + i] = j * cell + (random() - 0.5) * 2 * jitter;
    }
  }
  const tri = new Int32Array(nx * ny * 6);
  let t = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const n00 = j * stride + i;
      const n10 = n00 + 1;
      const n01 = n00 + stride;
      const n11 = n01 + 1;
      const quad =
        random() < 0.5
          ? [n00, n10, n11, n00, n11, n01]
          : [n00, n10, n01, n10, n11, n01];
      tri.set(quad, t);
      t += 6;
    }
  }
  return { x, y, tri };
};
