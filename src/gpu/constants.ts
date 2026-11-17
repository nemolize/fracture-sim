import {
  BALL_FLOOR_DRAG,
  BALL_RESTITUTION,
  CONTACT_DAMPING,
  CONTACT_STIFFNESS,
  FLOOR_FRICTION,
  FLOOR_RESTITUTION,
  GRAB_DAMPING,
  GRAB_RADIUS,
  GRAB_STIFFNESS,
  MAX_BALLS,
} from "@/sim/contact";
import {
  MIN_DEFORMATION_DET,
  MIN_STRETCH,
  VISCOSITY_PER_YOUNGS,
} from "@/sim/materials";
import { WORLD_WIDTH } from "@/sim/scenes";
import { PLASTIC_FULL_SCALE, VIEW_MODES } from "@/sim/view";

import { BALL_WORKGROUP_SIZE, WORKGROUP_SIZE } from "./layout";

/** An f32 literal: WGSL reads a bare `20000` as an integer. */
export const f32Literal = (value: number): string => {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
};

const FLOAT_CONSTANTS: Record<string, number> = {
  FLOOR_FRICTION,
  FLOOR_RESTITUTION,
  CONTACT_STIFFNESS,
  CONTACT_DAMPING,
  BALL_RESTITUTION,
  BALL_FLOOR_DRAG,
  GRAB_STIFFNESS,
  GRAB_DAMPING,
  GRAB_RADIUS,
  MIN_STRETCH,
  MIN_DEFORMATION_DET,
  VISCOSITY_PER_YOUNGS,
  PLASTIC_FULL_SCALE,
  WORLD_WIDTH,
};

/**
 * WGSL `const` declarations for every solver and render constant that has a
 * TypeScript source, so the shaders never carry a second copy of a number.
 */
export const wgslConstants = (): string =>
  [
    ...Object.entries(FLOAT_CONSTANTS).map(
      ([name, value]) => `const ${name}: f32 = ${f32Literal(value)};`,
    ),
    `const MAX_BALLS: u32 = ${String(MAX_BALLS)}u;`,
    `const WORKGROUP_SIZE: u32 = ${String(WORKGROUP_SIZE)}u;`,
    `const BALL_WORKGROUP_SIZE: u32 = ${String(BALL_WORKGROUP_SIZE)}u;`,
    ...VIEW_MODES.map(
      (mode, id) => `const VIEW_${mode.toUpperCase()}: u32 = ${String(id)}u;`,
    ),
  ].join("\n");
