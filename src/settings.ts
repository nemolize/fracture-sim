import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentSettings,
} from "@/rigid/environment";
import type { Tool } from "@/rigid/tools";
import { type Scene, SCENES } from "@/rigid/types";
import { DEFAULT_MATERIAL, type MaterialSettings } from "@/sim/material";

export interface Settings {
  scene: Scene;
  environment: EnvironmentSettings;
  tool: Tool;
  /** Simulated seconds per real second. */
  speed: number;
  material: MaterialSettings;
  inertiaScale: number;
  inertiaCap: number;
  tiltSmoothing: number;
}

/** Slider limits of the motion settings; chosen empirically, no fixed source. */
export const MOTION_RANGES = {
  inertiaScale: { min: 0, max: 2, step: 0.1 },
  inertiaCap: { min: 0, max: 40, step: 1 },
  tiltSmoothing: { min: 0, max: 1, step: 0.05 },
} as const;

export const DEFAULT_SETTINGS: Settings = {
  scene: "plate",
  environment: DEFAULT_ENVIRONMENT,
  tool: "grab",
  speed: 1,
  material: DEFAULT_MATERIAL,
  inertiaScale: 1,
  inertiaCap: 20,
  tiltSmoothing: 0.1,
};

export const asScene = (value: string): Scene | undefined =>
  SCENES.find((name) => name === value);
