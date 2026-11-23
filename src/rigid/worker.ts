import type { Snapshot, WorkerRequest, WorkerResponse } from "./types";
import { initializePhysics, RigidWorld } from "./world";

let world: RigidWorld | undefined;
const send = (message: WorkerResponse, transfer: Transferable[] = []): void => {
  postMessage(message, { transfer });
};
const buffers = (
  snapshot: Snapshot,
  vertices?: Float32Array<ArrayBuffer>,
): Transferable[] => [
  snapshot.poses.buffer,
  snapshot.particles.buffer,
  ...(vertices === undefined ? [] : [vertices.buffer]),
];

onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const request = event.data;
  void (async () => {
    try {
      if (request.type === "init") {
        await initializePhysics();
        world?.dispose();
        world = new RigidWorld(
          request.environment,
          request.objectSize,
          request.objectShape,
          request.materials,
        );
        if (request.visibleHeight !== undefined)
          world.setVisibleHeight(request.visibleHeight);
        const vertices = world.vertices();
        const snapshot = world.snapshot();
        send(
          { type: "ready", vertices, snapshot },
          buffers(snapshot, vertices),
        );
      } else {
        if (world === undefined) throw new Error("Physics worker is not ready");
        if (request.type === "resize") {
          world.setVisibleHeight(request.visibleHeight);
        } else if (request.type === "action") {
          const changed = world.apply(request.action);
          const snapshot = world.snapshot();
          if (changed) {
            const vertices = world.vertices();
            send(
              { type: "edited", snapshot, vertices },
              buffers(snapshot, vertices),
            );
          } else send({ type: "edited", snapshot }, buffers(snapshot));
        } else {
          const revision = world.geometryRevision;
          const snapshot = world.advance(
            request.seconds,
            request.gravity,
            request.materials,
          );
          if (revision !== world.geometryRevision) {
            const vertices = world.vertices();
            send(
              { type: "frame", snapshot, vertices },
              buffers(snapshot, vertices),
            );
          } else send({ type: "frame", snapshot }, buffers(snapshot));
        }
      }
    } catch (error) {
      send({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};
