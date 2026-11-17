// A page for the e2e tests: it drives the solver and renderer directly, which
// the app UI cannot do at a given step or with pixel-exact reads.
import { acquireGpu, gpuContext } from "@/gpu/device";
import type { Aim } from "@/gpu/frame";
import { FrameLoop } from "@/gpu/loop";
import { Renderer } from "@/gpu/renderer";
import { GpuSolver, type SolverOptions } from "@/gpu/solver";
import { TextureUsage } from "@/gpu/usage";
import { type Op, runScript } from "@/sim/script";
import type { ViewMode } from "@/sim/view";

import { probe } from "./probe";
import { readTexture } from "./readback";

let devicePromise: Promise<GPUDevice> | null = null;
/** Keeps the adapter referenced for the page's lifetime. */
const held: { adapter: GPUAdapter | null } = { adapter: null };
const getDevice = (): Promise<GPUDevice> => {
  devicePromise ??= acquireGpu(navigator).then((state) => {
    if (state.status !== "ready") throw new Error(state.reason);
    held.adapter = state.handle;
    return state.device;
  });
  return devicePromise;
};

export interface RunConfig extends SolverOptions {
  steps: number;
  ops: Op[];
}

const solverFor = async (config: SolverOptions): Promise<GpuSolver> =>
  new GpuSolver(await getDevice(), config);

const finite = (arrays: ArrayLike<number>[]): boolean =>
  arrays.every((array) => Array.from(array).every(Number.isFinite));

const harness = {
  probe,

  /** Runs a script and returns the state, as plain arrays. */
  async run(config: RunConfig) {
    const solver = await solverFor(config);
    runScript(solver, config.ops, config.steps);
    const state = await solver.snapshot();
    solver.dispose();
    return {
      dt: solver.dt,
      nodeCount: solver.nodeCount,
      triCount: solver.triCount,
      time: state.time,
      x: Array.from(state.x),
      y: Array.from(state.y),
      vx: Array.from(state.vx),
      vy: Array.from(state.vy),
      alive: Array.from(state.alive),
      plasticStrain: Array.from(state.plasticStrain),
      balls: state.balls,
    };
  },

  /** Simulates `seconds` of simulated time and reports whether every value stayed finite. */
  async sweep(config: SolverOptions & { seconds: number; ops: Op[] }) {
    const solver = await solverFor(config);
    const total = Math.ceil(config.seconds / solver.dt);
    const chunk = 5000;
    let allFinite = true;
    for (let from = 0; from < total && allFinite; from += chunk) {
      const to = Math.min(from + chunk, total);
      const ops = config.ops
        .filter((op) => op.at >= from && op.at < to)
        .map((op) => ({ ...op, at: op.at - from }));
      runScript(solver, ops, to - from);
      await solver.idle();
      const state = await solver.snapshot();
      allFinite = finite([
        state.x,
        state.y,
        state.vx,
        state.vy,
        state.damage,
        state.plasticStrain,
        state.stressRatio,
        ...state.balls.map(({ x, y, vx, vy, mass }) => [x, y, vx, vy, mass]),
      ]);
    }
    solver.dispose();
    return {
      steps: total,
      dt: solver.dt,
      triCount: solver.triCount,
      allFinite,
    };
  },

  /** Steps per second of the GPU solver, with the GPU awaited at the end. */
  async measureSteps(config: SolverOptions & { milliseconds: number }) {
    const solver = await solverFor(config);
    solver.step(200);
    await solver.idle();
    const start = performance.now();
    let steps = 0;
    while (performance.now() - start < config.milliseconds) {
      solver.step(200);
      steps += 200;
      await solver.idle();
    }
    const seconds = (performance.now() - start) / 1000;
    solver.dispose();
    return {
      stepsPerSecond: steps / seconds,
      triCount: solver.triCount,
      dt: solver.dt,
    };
  },

  /** Runs the real frame loop for `seconds` and returns its counters. */
  async frameLoop(config: SolverOptions & { seconds: number; speed: number }) {
    const device = await getDevice();
    const solver = new GpuSolver(device, config);
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 560;
    document.body.append(canvas);
    const context = gpuContext(canvas);
    if (context === null) throw new Error("no webgpu canvas context");
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });
    const renderer = new Renderer(
      device,
      solver.buffers,
      config.material,
      format,
      solver.triCount,
    );
    const loop = new FrameLoop({
      solver,
      renderer,
      context,
      canvas,
      input: () => ({
        speed: config.speed,
        paused: false,
        view: "material",
        aim: null,
      }),
      onStats: () => undefined,
    });
    loop.start();
    await new Promise((resolve) => setTimeout(resolve, config.seconds * 1000));
    loop.stop();
    const counters = { ...loop.counters };
    canvas.remove();
    renderer.dispose();
    solver.dispose();
    return { ...counters, dt: solver.dt, triCount: solver.triCount };
  },

  /** Renders after a script and classifies the pixels; `samples` are world points to read. */
  async render(
    config: RunConfig & {
      view: ViewMode;
      aim: Aim | null;
      samples: [number, number][];
    },
  ) {
    const device = await getDevice();
    const solver = new GpuSolver(device, config);
    runScript(solver, config.ops, config.steps);
    const width = 1000;
    const height = 560;
    const format = "rgba8unorm";
    const texture = device.createTexture({
      size: { width, height },
      format,
      usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC,
    });
    const renderer = new Renderer(
      device,
      solver.buffers,
      config.material,
      format,
      solver.triCount,
    );
    renderer.draw(texture.createView(), width, height, config.view, config.aim);
    const pixels = await readTexture(device, texture, width, height);
    const scale = width / 10;
    const floorPixel = height - 0.4 * scale;
    const at = (x: number, y: number): number[] => {
      const px = Math.round(x * scale);
      const py = Math.round(floorPixel - y * scale);
      const index = 4 * (py * width + px);
      return Array.from(pixels.subarray(index, index + 4));
    };
    const histogram: Record<string, number> = {};
    for (let i = 0; i < pixels.length; i += 4) {
      const key = `${String(pixels[i])},${String(pixels[i + 1])},${String(pixels[i + 2])}`;
      histogram[key] = (histogram[key] ?? 0) + 1;
    }
    renderer.dispose();
    solver.dispose();
    return { histogram, samples: config.samples.map(([x, y]) => at(x, y)) };
  },
};

export type Harness = typeof harness;
Object.assign(window, { harness });
