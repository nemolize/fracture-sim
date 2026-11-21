import type { EnvironmentSettings } from "@/rigid/environment";
import type { ObjectShape } from "@/rigid/object-shape";
import type { ObjectSize } from "@/rigid/object-size";
import type { ToolAction } from "@/rigid/tools";
import type { Scene, WorkerRequest, WorkerResponse } from "@/rigid/types";
import { DEFAULT_CRACK_ENERGY } from "@/sim/material";

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

const harness = {
  action: (action: ToolAction) => request({ type: "action", action }),
  reset: (
    scene: Scene,
    environment?: EnvironmentSettings,
    objectSize?: ObjectSize,
    objectShape?: ObjectShape,
  ) =>
    request({
      type: "init",
      scene,
      ...(environment === undefined ? {} : { environment }),
      ...(objectSize === undefined ? {} : { objectSize }),
      ...(objectShape === undefined ? {} : { objectShape }),
    }),
  step: (
    seconds: number,
    gravity = { x: 0, y: -9.8 },
    crackEnergy = DEFAULT_CRACK_ENERGY,
    friction?: number,
  ) =>
    request({
      type: "advance",
      seconds,
      gravity,
      crackEnergy,
      ...(friction === undefined ? {} : { friction }),
    }),
};
Object.assign(window, { harness });
export type Harness = typeof harness;
