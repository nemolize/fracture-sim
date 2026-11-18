import type { Vec2 } from "@/sim/vec2";

import { limitVelocity, type Tool, type ToolAction } from "./tools";

interface PointerSample {
  id: number;
  point: Vec2;
  time: number;
}
interface Gesture {
  tool: "grab" | "throw";
  start: Vec2;
  sample: PointerSample;
  velocity: Vec2;
  motionTime: number;
}

export class PointerGesture {
  private active: Gesture | null = null;
  private readonly send: (action: ToolAction) => void;
  constructor(send: (action: ToolAction) => void) {
    this.send = send;
  }

  down(tool: Tool, sample: PointerSample): boolean {
    if (this.active !== null) return false;
    if (tool === "blast") {
      this.send({ type: "blast", point: sample.point });
      return false;
    }
    this.active = {
      tool,
      start: sample.point,
      sample,
      velocity: { x: 0, y: 0 },
      motionTime: sample.time,
    };
    if (tool === "grab") this.send({ type: "grab", point: sample.point });
    return true;
  }

  move(sample: PointerSample): void {
    const active = this.active;
    if (sample.id !== active?.sample.id) return;
    const seconds = (sample.time - active.sample.time) / 1000;
    if (seconds > 0) {
      if (
        sample.point.x !== active.sample.point.x ||
        sample.point.y !== active.sample.point.y
      ) {
        active.velocity = limitVelocity({
          x: (sample.point.x - active.sample.point.x) / seconds,
          y: (sample.point.y - active.sample.point.y) / seconds,
        });
        active.motionTime = sample.time;
      }
      active.sample = sample;
    }
    if (active.tool === "grab")
      this.send({ type: "move", point: sample.point });
  }

  up(sample: PointerSample): void {
    const active = this.active;
    if (sample.id !== active?.sample.id) return;
    this.move(sample);
    if (active.tool === "grab") {
      this.send({
        type: "release",
        velocity:
          sample.time - active.motionTime > 100
            ? { x: 0, y: 0 }
            : active.velocity,
      });
    } else {
      this.send({
        type: "throw",
        point: active.start,
        velocity: limitVelocity({
          x: (sample.point.x - active.start.x) * 4,
          y: (sample.point.y - active.start.y) * 4,
        }),
      });
    }
    this.active = null;
  }

  cancel(id?: number): void {
    if (id !== undefined && this.active?.sample.id !== id) return;
    if (this.active?.tool === "grab")
      this.send({ type: "release", velocity: { x: 0, y: 0 } });
    this.active = null;
  }
}
