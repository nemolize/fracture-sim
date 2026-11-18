import type { WorkerRequest, WorkerResponse } from "./types";
import { initializePhysics, RigidWorld } from "./world";

let world: RigidWorld | undefined;
const send = (message: WorkerResponse, transfer: Transferable[] = []): void => {
  postMessage(message, { transfer });
};

onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const request = event.data;
  void (async () => {
    try {
      if (request.type === "init") {
        await initializePhysics();
        world?.dispose();
        world = new RigidWorld(request.scene);
        const vertices = world.vertices();
        const snapshot = world.snapshot();
        send({ type: "ready", vertices, snapshot }, [
          vertices.buffer,
          snapshot.poses.buffer,
        ]);
      } else {
        if (world === undefined) throw new Error("Physics worker is not ready");
        if (request.type === "action") {
          const changed = world.apply(request.action);
          const snapshot = world.snapshot();
          if (changed) {
            const vertices = world.vertices();
            send({ type: "edited", snapshot, vertices }, [
              vertices.buffer,
              snapshot.poses.buffer,
            ]);
          } else send({ type: "edited", snapshot }, [snapshot.poses.buffer]);
        } else {
          const snapshot = world.advance(request.seconds, request.gravity);
          send({ type: "frame", snapshot }, [snapshot.poses.buffer]);
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
