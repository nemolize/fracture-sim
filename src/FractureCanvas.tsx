import { useEffect, useRef } from "react";

import { canvasSize, VIEW_HEIGHT } from "@/gpu/camera";
import { gpuContext } from "@/gpu/device";
import { WORLD_WIDTH } from "@/rigid/constants";
import { RigidRenderer } from "@/rigid/renderer";
import type { WorkerRequest, WorkerResponse, WorldStats } from "@/rigid/types";
import type { Settings } from "@/settings";
import type { MotionTracker } from "@/sim/motion";

interface Props {
  device: GPUDevice;
  settings: Settings;
  tracker: MotionTracker;
  paused: boolean;
  resetToken: number;
  onStats: (stats: WorldStats) => void;
  onContextUnavailable: (message: string) => void;
  onPhysicsError: (message: string) => void;
}

export const FractureCanvas = ({
  device,
  settings,
  tracker,
  paused,
  resetToken,
  onStats,
  onContextUnavailable,
  onPhysicsError,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({
    settings,
    paused,
    onStats,
    onContextUnavailable,
    onPhysicsError,
  });
  useEffect(() => {
    latest.current = {
      settings,
      paused,
      onStats,
      onContextUnavailable,
      onPhysicsError,
    };
  });
  const { scene } = settings;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = gpuContext(canvas);
    if (context === null) {
      latest.current.onContextUnavailable(
        "the canvas could not create a WebGPU context",
      );
      return;
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });
    const worker = new Worker(new URL("./rigid/worker.ts", import.meta.url), {
      type: "module",
    });
    const send = (request: WorkerRequest): void => {
      worker.postMessage(request);
    };
    let renderer: RigidRenderer | undefined;
    let poses: Float32Array<ArrayBuffer> | undefined;
    let stopped = false;
    let pending = false;
    let previous: number | null = null;
    let animation = 0;

    const fail = (message: string): void => {
      stopped = true;
      cancelAnimationFrame(animation);
      latest.current.onPhysicsError(message);
    };
    worker.onerror = (event) => {
      fail(event.message);
    };
    worker.onmessageerror = () => {
      fail("Could not read the physics worker response");
    };
    worker.onmessage = (event: MessageEvent<WorkerResponse>): void => {
      if (stopped) return;
      const response = event.data;
      if (response.type === "error") {
        fail(response.message);
        return;
      }
      if (response.type === "ready") {
        renderer = new RigidRenderer(
          device,
          format,
          response.vertices,
          response.snapshot.poses,
        );
      }
      pending = false;
      poses = response.snapshot.poses;
      latest.current.onStats(response.snapshot.stats);
    };
    const resize = (): void => {
      const size = canvasSize(canvas.clientWidth, window.devicePixelRatio);
      if (canvas.width !== size.width) canvas.width = size.width;
      if (canvas.height !== size.height) canvas.height = size.height;
    };
    resize();
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    });
    observer.observe(canvas);

    const resetClock = (): void => {
      previous = null;
    };
    document.addEventListener("visibilitychange", resetClock);

    const frame = (now: number): void => {
      if (stopped) return;
      const seconds =
        previous === null || document.hidden
          ? 0
          : Math.min((now - previous) / 1000, 0.1);
      if (renderer !== undefined && !pending) {
        const input = latest.current;
        send({
          type: "advance",
          seconds: input.paused ? 0 : seconds * input.settings.speed,
          gravity: tracker.gravity(input.settings, now),
        });
        previous = now;
        pending = true;
      }
      if (renderer !== undefined && poses !== undefined) {
        renderer.draw(context.getCurrentTexture().createView(), poses);
      }
      animation = requestAnimationFrame(frame);
    };
    send({ type: "init", scene });
    animation = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(animation);
      worker.terminate();
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      renderer?.dispose();
      context.unconfigure();
      document.removeEventListener("visibilitychange", resetClock);
    };
  }, [device, tracker, scene, resetToken]);

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
