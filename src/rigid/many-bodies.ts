/* eslint-disable @typescript-eslint/dot-notation -- Reach into the real engine fixture without exposing mutation APIs to the app. */
import type { EnvironmentSettings } from "./environment";
import type { RigidWorld } from "./world";

const COLUMNS = 60;
const SPACING = 0.14;
const HALF_SIDE = 0.06;
const FIRST_X = 0.8;
const FIRST_Y = 0.065;

const layoutScale = ({ width, height }: EnvironmentSettings): number =>
  Math.min(1, width / 10, height / 5.2);

export const addBoxGrid = (
  world: RigidWorld,
  count: number,
  environment: EnvironmentSettings,
): void => {
  const scale = layoutScale(environment);
  for (let i = 0; i < count; i++)
    world["box"](
      (FIRST_X + (i % COLUMNS) * SPACING) * scale,
      (FIRST_Y + Math.floor(i / COLUMNS) * SPACING) * scale,
      HALF_SIDE * scale,
      HALF_SIDE * scale,
      world["live"].object,
      false,
    );
};
