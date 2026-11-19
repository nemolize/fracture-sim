import type { ToolAction } from "./tools";

export const SCENES = ["plate", "pile", "stress"] as const;
export type Scene = (typeof SCENES)[number];

export interface WorldStats {
  mass: number;
  bodies: number;
  sleeping: number;
  stepMs: number;
  time: number;
}

export interface Snapshot {
  poses: Float32Array<ArrayBuffer>;
  stats: WorldStats;
}

export type WorkerRequest =
  | { type: "init"; scene: Scene }
  | { type: "action"; action: ToolAction }
  | {
      type: "advance";
      seconds: number;
      gravity: { x: number; y: number };
      fractureToughness?: number;
    };

export type WorkerResponse =
  | { type: "ready"; vertices: Float32Array<ArrayBuffer>; snapshot: Snapshot }
  | { type: "frame"; snapshot: Snapshot; vertices?: Float32Array<ArrayBuffer> }
  | { type: "edited"; snapshot: Snapshot; vertices?: Float32Array<ArrayBuffer> }
  | { type: "error"; message: string };
