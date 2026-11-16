import { useEffect, useRef } from "react";

import type { Settings } from "@/settings";
import { drawWorld, type Overlay, VIEW_HEIGHT } from "@/sim/draw";
import { WORLD_WIDTH } from "@/sim/scenes";
import { DT, World, type WorldStats } from "@/sim/world";

/** Cap the backing store on high-DPI displays: past 2x the extra pixels are not visible. */
const MAX_PIXEL_RATIO = 2;
/** Longest real frame the clock accepts, so a background tab does not trigger a burst of steps. */
const MAX_FRAME_SECONDS = 0.05;
/** Upper bound on solver steps per frame; the simulation slows down rather than freezing the page. */
const MAX_STEPS_PER_FRAME = 120;
const THROW_SPEED_PER_METRE = 4;
const MAX_THROW_SPEED = 25;
/** Distance of the floor below the lowest visible world coordinate, in metres. */
const FLOOR_MARGIN = 0.4;

interface Props {
  settings: Settings;
  paused: boolean;
  /** Bumped by the Reset button to rebuild the world with unchanged settings. */
  resetToken: number;
  onStats: (stats: WorldStats) => void;
}

export const FractureCanvas = ({
  settings,
  paused,
  resetToken,
  onStats,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read inside the frame loop through refs so a slider move does not rebuild the world.
  const settingsRef = useRef(settings);
  const pausedRef = useRef(paused);
  const onStatsRef = useRef(onStats);
  useEffect(() => {
    settingsRef.current = settings;
    pausedRef.current = paused;
    onStatsRef.current = onStats;
  });

  const { scene, material } = settings;
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas === null || !ctx) return;

    const world = new World({ scene, material });
    const overlay: Overlay = { aim: null };
    let frameId = 0;
    let last = 0;
    let clock = 0;
    let frame = 0;
    let erodedAtChunks = 0;

    const resize = (): void => {
      const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
      const width = canvas.clientWidth;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round((width * VIEW_HEIGHT * ratio) / WORLD_WIDTH);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const toWorld = (event: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / WORLD_WIDTH;
      return {
        x: (event.clientX - rect.left) / scale,
        y:
          (rect.height - FLOOR_MARGIN * scale - (event.clientY - rect.top)) /
          scale,
      };
    };

    const onPointerDown = (event: PointerEvent): void => {
      const point = toWorld(event);
      const { tool } = settingsRef.current;
      canvas.setPointerCapture(event.pointerId);
      if (tool === "throw") {
        overlay.aim = { x0: point.x, y0: point.y, x1: point.x, y1: point.y };
      } else if (tool === "pull") {
        world.startGrab(point.x, point.y);
      } else {
        world.blast(point.x, point.y);
      }
    };
    const onPointerMove = (event: PointerEvent): void => {
      const point = toWorld(event);
      if (overlay.aim !== null) {
        overlay.aim.x1 = point.x;
        overlay.aim.y1 = point.y;
      }
      world.moveGrab(point.x, point.y);
    };
    const onPointerUp = (): void => {
      const { aim } = overlay;
      if (aim !== null) {
        const dx = (aim.x1 - aim.x0) * THROW_SPEED_PER_METRE;
        const dy = (aim.y1 - aim.y0) * THROW_SPEED_PER_METRE;
        const length = Math.hypot(dx, dy);
        const limit = length > MAX_THROW_SPEED ? MAX_THROW_SPEED / length : 1;
        world.throwBall(aim.x0, aim.y0, dx * limit, dy * limit);
        overlay.aim = null;
      }
      world.endGrab();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    const tick = (now: number): void => {
      frameId = requestAnimationFrame(tick);
      const elapsed = Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
      last = now;
      if (!pausedRef.current) {
        clock += elapsed * settingsRef.current.speed;
        const steps = Math.min(Math.floor(clock / DT), MAX_STEPS_PER_FRAME);
        for (let s = 0; s < steps; s++) world.step();
        clock = steps === MAX_STEPS_PER_FRAME ? 0 : clock - steps * DT;
      }
      frame++;
      // Piece labelling walks every triangle, so run it a few times a second and only after a break.
      if (frame % 10 === 0) {
        const eroded = world.stats().erodedFraction;
        if (eroded !== erodedAtChunks) {
          erodedAtChunks = eroded;
          world.refreshChunks();
        }
        onStatsRef.current(world.stats());
      }
      drawWorld(
        ctx,
        world,
        settingsRef.current.view,
        canvas.width,
        canvas.height,
        overlay,
      );
    };
    frameId = requestAnimationFrame((now) => {
      last = now;
      tick(now);
    });

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [scene, material, resetToken]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Fracture simulation"
      className="aspect-[10/5.6] w-full touch-none rounded-lg bg-gray-100 shadow"
    />
  );
};
