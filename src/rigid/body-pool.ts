/* eslint-disable @typescript-eslint/dot-notation -- Reach into the real engine fixture without exposing mutation APIs to the app. */
import { MAX_BODIES } from "./fracture";
import type { RigidWorld } from "./world";

// The four fixed boundary bodies and the plate come first in the world's shapes.
const FIRST_BALL_INDEX = 5;

export const fillBodyPool = (world: RigidWorld): void => {
  for (let i = 1; i < MAX_BODIES; i++)
    world.apply({
      type: "throw",
      point: { x: 1, y: 4 },
      velocity: { x: 0, y: 0 },
    });
};

export const parkBalls = (world: RigidWorld): void => {
  for (const [i, shape] of world["shapes"].slice(FIRST_BALL_INDEX).entries())
    shape.body.setTranslation({ x: 100 + i, y: 100 }, true);
  world["world"].propagateModifiedBodyPositionsToColliders();
};
