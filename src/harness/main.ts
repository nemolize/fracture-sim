import type { ToolAction } from "@/rigid/tools";
import type { Scene, WorkerRequest, WorkerResponse } from "@/rigid/types";

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
  reset: (scene: Scene) => request({ type: "init", scene }),
  step: (seconds: number, gravity = { x: 0, y: -9.8 }) =>
    request({ type: "advance", seconds, gravity }),
};
Object.assign(window, { harness });
export type Harness = typeof harness;
