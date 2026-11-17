import { type MaterialName } from "../src/sim/materials";
import { type Metrics, summarise } from "../src/sim/metrics";
import { type ResolutionName, RESOLUTIONS } from "../src/sim/resolution";
import { restShape } from "../src/sim/rest";
import { buildMesh, type SceneName } from "../src/sim/scenes";
import { type Op, runScript, type Steppable } from "../src/sim/script";
import { World } from "../src/sim/world";

export interface Case {
  scene: SceneName;
  material: MaterialName;
  resolution: ResolutionName;
  steps: number;
  ops: Op[];
  seed?: number;
}

export interface Final {
  x: number[];
  y: number[];
  vx: number[];
  vy: number[];
  balls: { x: number; y: number; vx: number; vy: number }[];
  metrics: Metrics;
}

const asSteppable = (world: World): Steppable => ({
  step: (count) => {
    for (let s = 0; s < count; s++) world.step();
  },
  throwBall: (x, y, vx, vy) => {
    world.throwBall(x, y, vx, vy);
  },
  blast: (x, y) => {
    world.blast(x, y);
  },
  startGrab: (x, y) => {
    world.startGrab(x, y);
  },
  moveGrab: (x, y) => {
    world.moveGrab(x, y);
  },
  endGrab: () => {
    world.endGrab();
  },
});

/** The f64 CPU reference run of a case. */
export const runReference = (c: Case): Final => {
  const world = new World({
    scene: c.scene,
    material: c.material,
    cell: RESOLUTIONS[c.resolution].cell,
    ...(c.seed === undefined ? {} : { seed: c.seed }),
  });
  runScript(asSteppable(world), c.ops, c.steps);
  world.refreshChunks();
  return {
    x: Array.from(world.x),
    y: Array.from(world.y),
    vx: Array.from(world.vx),
    vy: Array.from(world.vy),
    balls: world.balls.map(({ x, y, vx, vy }) => ({ x, y, vx, vy })),
    metrics: summarise(world),
  };
};

/** The metrics of a GPU run, computed by the same function as the reference's. */
export const gpuMetrics = (
  c: Case,
  gpu: { x: number[]; y: number[]; alive: number[]; plasticStrain: number[] },
): Metrics => {
  const mesh = buildMesh(c.scene, c.seed ?? 1, RESOLUTIONS[c.resolution].cell);
  return summarise({
    tri: mesh.tri,
    restArea: restShape(mesh).area,
    nodeCount: mesh.x.length,
    x: gpu.x,
    y: gpu.y,
    alive: Uint8Array.from(gpu.alive),
    plasticStrain: gpu.plasticStrain,
  });
};
