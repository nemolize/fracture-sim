import type { WorldStats } from "@/sim/stats";
import type { ViewMode } from "@/sim/view";

import { type Aim } from "./frame";
import { planFrame, SkippedTime } from "./pacing";
import type { Renderer } from "./renderer";
import type { GpuSolver } from "./solver";

/** Frames between two statistics read-backs. */
const STATS_EVERY_FRAMES = 10;

export interface LoopInput {
  speed: number;
  paused: boolean;
  view: ViewMode;
  aim: Aim | null;
}

export interface LoopCounters {
  frames: number;
  steps: number;
  /** Frames the per-frame step cap cut short. */
  cappedFrames: number;
  /** Frames skipped because the GPU had not finished the previous one. */
  skippedFrames: number;
}

/** Steps at the pace `planFrame` asks for, then draws; skips a frame while the GPU is still busy. */
export class FrameLoop {
  readonly counters: LoopCounters = {
    frames: 0,
    steps: 0,
    cappedFrames: 0,
    skippedFrames: 0,
  };

  private readonly solver: GpuSolver;
  private readonly renderer: Renderer;
  private readonly context: GPUCanvasContext;
  private readonly canvas: { width: number; height: number };
  private readonly input: () => LoopInput;
  private readonly onStats: (stats: WorldStats) => void;
  private frameId = 0;
  private last = 0;
  private clock = 0;
  private busy = false;
  private readonly skipped = new SkippedTime();
  private stopped = false;

  constructor(options: {
    solver: GpuSolver;
    renderer: Renderer;
    context: GPUCanvasContext;
    canvas: { width: number; height: number };
    input: () => LoopInput;
    onStats: (stats: WorldStats) => void;
  }) {
    this.solver = options.solver;
    this.renderer = options.renderer;
    this.context = options.context;
    this.canvas = options.canvas;
    this.input = options.input;
    this.onStats = options.onStats;
  }

  start(): void {
    this.frameId = requestAnimationFrame((now) => {
      this.last = now;
      this.tick(now);
    });
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.frameId);
  }

  private tick(now: number): void {
    this.frameId = requestAnimationFrame((next) => {
      this.tick(next);
    });
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    const owedSeconds = this.skipped.take(elapsed, this.busy);
    if (owedSeconds === null) {
      this.counters.skippedFrames++;
      return;
    }
    const { speed, paused, view, aim } = this.input();
    if (!paused) {
      const plan = planFrame(this.clock, owedSeconds, speed, this.solver.dt);
      this.clock = plan.clock;
      if (plan.capped) this.counters.cappedFrames++;
      this.counters.steps += plan.steps;
      this.solver.step(plan.steps);
    }
    this.counters.frames++;
    if (this.counters.frames % STATS_EVERY_FRAMES === 0) {
      void this.solver.readStats().then((stats) => {
        if (stats !== null && !this.stopped) this.onStats(stats);
      });
    }
    this.renderer.draw(
      this.context.getCurrentTexture().createView(),
      this.canvas.width,
      this.canvas.height,
      view,
      aim,
    );
    this.busy = true;
    void this.solver.idle().then(() => {
      this.busy = false;
    });
  }
}
