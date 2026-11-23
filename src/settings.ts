import {
  type EnvironmentSettings,
  INITIAL_ENVIRONMENT,
} from "@/rigid/environment";
import type { ObjectShape } from "@/rigid/object-shape";
import { DEFAULT_OBJECT_SIZE, type ObjectSize } from "@/rigid/object-size";
import type { Tool } from "@/rigid/tools";
import {
  DEFAULT_FLOOR_MATERIAL,
  type FloorMaterialSettings,
} from "@/sim/floor-material";
import { DEFAULT_MATERIAL, type MaterialSettings } from "@/sim/material";

export interface Settings {
  environment: EnvironmentSettings;
  objectSize: ObjectSize;
  objectShape: ObjectShape;
  tool: Tool;
  material: MaterialSettings;
  floorMaterial: FloorMaterialSettings;
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
  environment: INITIAL_ENVIRONMENT,
  objectSize: DEFAULT_OBJECT_SIZE,
  objectShape: "rectangle",
  tool: "grab",
  material: DEFAULT_MATERIAL,
  floorMaterial: DEFAULT_FLOOR_MATERIAL,
  inertiaScale: 1,
  inertiaCap: 20,
  tiltSmoothing: 0.1,
};

export const resetParameters = (settings: Settings): Settings => ({
  ...DEFAULT_SETTINGS,
  tool: settings.tool,
});
