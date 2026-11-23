import type { EnvironmentSettings } from "@/rigid/environment";
import type { ObjectShape } from "@/rigid/object-shape";
import type { ObjectSize } from "@/rigid/object-size";
import type { ToolAction } from "@/rigid/tools";
import type { WorkerRequest, WorkerResponse } from "@/rigid/types";
import { DEFAULT_FLOOR_MATERIAL } from "@/sim/floor-material";
import {
  crackEnergy as crackEnergyOf,
  DEFAULT_MATERIAL,
  type LiveMaterials,
  liveMaterials,
  type WorldMaterials,
} from "@/sim/material";

const worker = new Worker(new URL("../rigid/worker.ts", import.meta.url), {
  type: "module",
});
let receive: ((message: WorkerResponse) => void) | undefined;
let reject: ((error: Error) => void) | undefined;
worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
  receive?.(event.data);
};
worker.onerror = (event) => {
  reject?.(new Error(event.message));
};
const request = (message: WorkerRequest): Promise<WorkerResponse> =>
  new Promise((resolve, fail) => {
    receive = resolve;
    reject = fail;
    worker.postMessage(message);
  });

const defaults: WorldMaterials = {
  floor: DEFAULT_FLOOR_MATERIAL,
  object: DEFAULT_MATERIAL,
};
let built = defaults;

const harness = {
  action: (action: ToolAction) => request({ type: "action", action }),
  reset: (
    environment?: EnvironmentSettings,
    objectSize?: ObjectSize,
    objectShape?: ObjectShape,
    materials: WorldMaterials = defaults,
  ) => {
    built = materials;
    return request({
      type: "init",
      ...(environment === undefined ? {} : { environment }),
      ...(objectSize === undefined ? {} : { objectSize }),
      ...(objectShape === undefined ? {} : { objectShape }),
      materials,
    });
  },
  step: (
    seconds: number,
    gravity = { x: 0, y: -9.8 },
    crackEnergy = crackEnergyOf(built.object),
    live: Partial<LiveMaterials> = {},
  ) =>
    request({
      type: "advance",
      seconds,
      gravity,
      materials: { ...liveMaterials(built), crackEnergy, ...live },
    }),
};
Object.assign(window, { harness });
export type Harness = typeof harness;
