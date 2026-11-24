import type { LiveMaterials, WorldMaterials } from "@/sim/material";

import type { EnvironmentSettings } from "./environment";
import type { ObjectShape } from "./object-shape";
import type { ObjectSize } from "./object-size";
import type { ToolAction } from "./tools";

export interface WorldStats {
  mass: number;
  bodies: number;
  sleeping: number;
  particles: number;
  stepMs: number;
  time: number;
}

export interface Snapshot {
  poses: Float32Array<ArrayBuffer>;
  /** x, y and size per particle, three floats each. */
  particles: Float32Array<ArrayBuffer>;
  stats: WorldStats;
}

export type WorkerRequest =
  | {
      type: "init";
      environment?: EnvironmentSettings;
      materials?: WorldMaterials;
      objectSize?: ObjectSize;
      objectShape?: ObjectShape;
      visibleHeight?: number;
    }
  | { type: "resize"; visibleHeight: number }
  | { type: "action"; action: ToolAction }
  | {
      type: "advance";
      seconds: number;
      gravity: { x: number; y: number };
      materials?: LiveMaterials;
    };

export type WorkerResponse =
  | { type: "ready"; vertices: Float32Array<ArrayBuffer>; snapshot: Snapshot }
  | { type: "frame"; snapshot: Snapshot; vertices?: Float32Array<ArrayBuffer> }
  | { type: "edited"; snapshot: Snapshot; vertices?: Float32Array<ArrayBuffer> }
  | { type: "error"; message: string };
