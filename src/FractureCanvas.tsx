import { useEffect, useRef } from "react";

import { canvasSize, pointerToWorld, VIEW_HEIGHT } from "@/gpu/camera";
import { gpuContext } from "@/gpu/device";
import type { Aim } from "@/gpu/frame";
import { FrameLoop, type LoopInput } from "@/gpu/loop";
import { Renderer } from "@/gpu/renderer";
import { GpuSolver } from "@/gpu/solver";
import type { Settings } from "@/settings";
import { WORLD_WIDTH } from "@/sim/scenes";
import type { WorldStats } from "@/sim/stats";

const THROW_SPEED_PER_METRE = 4;
const MAX_THROW_SPEED = 25;

interface Props {
  device: GPUDevice;
  settings: Settings;
  paused: boolean;
  /** Bumped by the Reset button to rebuild the solver with unchanged settings. */
  resetToken: number;
  onStats: (stats: WorldStats) => void;
  /** The canvas cannot be configured for WebGPU. */
  onContextUnavailable: (message: string) => void;
}

export const FractureCanvas = ({
  device,
  settings,
  paused,
  resetToken,
  onStats,
  onContextUnavailable,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read inside the frame loop through refs so a slider move does not rebuild the solver.
  const settingsRef = useRef(settings);
  const pausedRef = useRef(paused);
  const onStatsRef = useRef(onStats);
  const onContextUnavailableRef = useRef(onContextUnavailable);
  useEffect(() => {
    settingsRef.current = settings;
    pausedRef.current = paused;
    onStatsRef.current = onStats;
    onContextUnavailableRef.current = onContextUnavailable;
  });

  const { scene, material, resolution } = settings;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = gpuContext(canvas);
    if (context === null) {
      onContextUnavailableRef.current(
        "the canvas could not create a WebGPU context",
      );
      return;
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });

    const solver = new GpuSolver(device, { scene, material, resolution });
    const renderer = new Renderer(
      device,
      solver.buffers,
      material,
      format,
      solver.triCount,
    );
    let aim: Aim | null = null;

    const resize = (): void => {
      const size = canvasSize(canvas.clientWidth, window.devicePixelRatio);
      canvas.width = size.width;
      canvas.height = size.height;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const toWorld = (event: PointerEvent) =>
      pointerToWorld(
        canvas.getBoundingClientRect(),
        event.clientX,
        event.clientY,
      );
    const onPointerDown = (event: PointerEvent): void => {
      const point = toWorld(event);
      const { tool } = settingsRef.current;
      canvas.setPointerCapture(event.pointerId);
      if (tool === "throw") {
        aim = { x0: point.x, y0: point.y, x1: point.x, y1: point.y };
      } else if (tool === "pull") {
        solver.startGrab(point.x, point.y);
      } else {
        solver.blast(point.x, point.y);
      }
    };
    const onPointerMove = (event: PointerEvent): void => {
      const point = toWorld(event);
      if (aim !== null) {
        aim.x1 = point.x;
        aim.y1 = point.y;
      }
      solver.moveGrab(point.x, point.y);
    };
    const onPointerUp = (): void => {
      if (aim !== null) {
        const dx = (aim.x1 - aim.x0) * THROW_SPEED_PER_METRE;
        const dy = (aim.y1 - aim.y0) * THROW_SPEED_PER_METRE;
        const length = Math.hypot(dx, dy);
        const limit = length > MAX_THROW_SPEED ? MAX_THROW_SPEED / length : 1;
        solver.throwBall(aim.x0, aim.y0, dx * limit, dy * limit);
        aim = null;
      }
      solver.endGrab();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    const loop = new FrameLoop({
      solver,
      renderer,
      context,
      canvas,
      input: (): LoopInput => ({
        speed: settingsRef.current.speed,
        paused: pausedRef.current,
        view: settingsRef.current.view,
        aim,
      }),
      onStats: (stats) => {
        onStatsRef.current(stats);
      },
    });
    loop.start();

    return () => {
      loop.stop();
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      renderer.dispose();
      solver.dispose();
    };
  }, [device, scene, material, resolution, resetToken]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Fracture simulation"
      width={WORLD_WIDTH * 100}
      height={VIEW_HEIGHT * 100}
      className="aspect-[10/5.6] w-full touch-none rounded-lg bg-gray-100 shadow"
    />
  );
};
