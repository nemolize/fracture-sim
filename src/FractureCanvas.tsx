import { useEffect, useRef } from "react";

import {
  canvasSize,
  floorMargin,
  pointerToWorld,
  visibleWorldHeight,
} from "@/gpu/camera";
import { gpuContext } from "@/gpu/device";
import { PointerGesture } from "@/rigid/gesture";
import { RigidRenderer } from "@/rigid/renderer";
import type { WorkerRequest, WorkerResponse, WorldStats } from "@/rigid/types";
import { ScaleBar } from "@/ScaleBar";
import type { Settings } from "@/settings";
import { crackEnergy } from "@/sim/material";
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
  children?: React.ReactNode;
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
  children,
}: Props) => {
  const cancelGesture = useRef<() => void>(() => undefined);
  useEffect(() => {
    cancelGesture.current();
  }, [settings.tool, paused]);
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
  const { scene, objectShape } = settings;
  const { width, height, density } = settings.environment;
  const { width: objectWidth, height: objectHeight } = settings.objectSize;

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
    const visibleHeight = (): number =>
      visibleWorldHeight(canvas.clientWidth, canvas.clientHeight, width);
    let sentHeight = visibleHeight();

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
      const vertices = response.vertices;
      if (vertices !== undefined) {
        renderer?.dispose();
        renderer = new RigidRenderer(
          device,
          format,
          vertices,
          response.snapshot.poses,
          { width },
        );
      }
      if (response.type !== "edited") pending = false;
      poses = response.snapshot.poses;
      latest.current.onStats(response.snapshot.stats);
    };
    const gesture = new PointerGesture((action) => {
      send({ type: "action", action });
    });
    cancelGesture.current = () => {
      gesture.cancel();
    };
    const sample = (event: PointerEvent) => ({
      id: event.pointerId,
      point: pointerToWorld(
        canvas.getBoundingClientRect(),
        event.clientX,
        event.clientY,
        { width },
      ),
      time: event.timeStamp,
    });
    const down = (event: PointerEvent): void => {
      if (
        renderer === undefined ||
        stopped ||
        latest.current.paused ||
        event.button !== 0 ||
        !event.isPrimary
      )
        return;
      if (gesture.down(latest.current.settings.tool, sample(event)))
        canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent): void => {
      gesture.move(sample(event));
    };
    const up = (event: PointerEvent): void => {
      gesture.up(sample(event));
    };
    const cancel = (event: PointerEvent): void => {
      gesture.cancel(event.pointerId);
    };
    const blur = (): void => {
      gesture.cancel();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("lostpointercapture", cancel);
    window.addEventListener("blur", blur);

    const resize = (): void => {
      const size = canvasSize(
        canvas.clientWidth,
        canvas.clientHeight,
        window.devicePixelRatio,
        device.limits.maxTextureDimension2D,
      );
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
      gesture.cancel();
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
        const visible = visibleHeight();
        if (Math.abs(visible - sentHeight) > 1e-3) {
          sentHeight = visible;
          send({ type: "resize", visibleHeight: visible });
        }
        send({
          type: "advance",
          seconds: input.paused ? 0 : seconds,
          gravity: tracker.gravity(
            { ...input.settings, gravity: input.settings.environment.gravity },
            now,
          ),
          friction: input.settings.environment.friction,
          crackEnergy: crackEnergy(input.settings.material),
        });
        previous = now;
        pending = true;
      }
      if (renderer !== undefined && poses !== undefined) {
        renderer.draw(context.getCurrentTexture().createView(), poses, canvas);
      }
      animation = requestAnimationFrame(frame);
    };
    send({
      type: "init",
      scene,
      objectSize: { width: objectWidth, height: objectHeight },
      objectShape,
      visibleHeight: sentHeight,
      environment: {
        ...latest.current.settings.environment,
        width,
        height,
        density,
      },
    });
    animation = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(animation);
      cancelGesture.current = () => undefined;
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("lostpointercapture", cancel);
      window.removeEventListener("blur", blur);
      worker.terminate();
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      renderer?.dispose();
      context.unconfigure();
      document.removeEventListener("visibilitychange", resetClock);
    };
  }, [
    device,
    tracker,
    scene,
    resetToken,
    width,
    height,
    density,
    objectWidth,
    objectHeight,
    objectShape,
  ]);

  return (
    <div className="relative flex-1">
      <div
        aria-hidden
        className="w-full"
        style={{
          aspectRatio: `${String(width)} / ${String(height + floorMargin(width))}`,
        }}
      />
      <canvas
        ref={canvasRef}
        aria-label="Fracture simulation"
        className="absolute inset-0 block h-full w-full touch-none rounded-lg bg-gray-100 shadow"
      />
      {children}
      <ScaleBar environment={settings.environment} />
    </div>
  );
};
