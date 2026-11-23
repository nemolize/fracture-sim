/* eslint-disable @typescript-eslint/dot-notation -- Reach into the real engine fixture without exposing mutation APIs to the app. */
import { WORLD_HEIGHT } from "./constants";
import { type EnvironmentSettings, worldScale } from "./environment";
import { MAX_BODIES } from "./fracture";
import type { RigidWorld } from "./world";

// The four fixed boundary bodies and the plate come first in the world's shapes.
const FIXED_BODIES = 4;
const FIRST_BALL_INDEX = FIXED_BODIES + 1;

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

const GRID_COLUMNS = 60;
const GRID_SPACING = 0.14;
const GRID_HALF_SIDE = 0.06;
const GRID_FIRST_X = 0.8;
const GRID_FIRST_Y = 0.065;

const gridScale = (environment: EnvironmentSettings): number =>
  Math.min(1, worldScale(environment), environment.height / WORLD_HEIGHT);

export const fillBoxGrid = (
  world: RigidWorld,
  total: number,
  environment: EnvironmentSettings,
): void => {
  for (const { body } of world["shapes"].slice(FIXED_BODIES))
    world["world"].removeRigidBody(body);
  world["shapes"].splice(FIXED_BODIES);
  const scale = gridScale(environment);
  for (let i = 0; i < total; i++)
    world["box"](
      (GRID_FIRST_X + (i % GRID_COLUMNS) * GRID_SPACING) * scale,
      (GRID_FIRST_Y + Math.floor(i / GRID_COLUMNS) * GRID_SPACING) * scale,
      GRID_HALF_SIDE * scale,
      GRID_HALF_SIDE * scale,
      world["live"].object,
      false,
    );
};
