import { type Scene, SCENES } from "@/rigid/types";

export interface Settings {
  scene: Scene;
  /** Simulated seconds per real second. */
  speed: number;
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
  speed: 1,
  inertiaScale: 1,
  inertiaCap: 20,
  tiltSmoothing: 0.1,
};

export const asScene = (value: string): Scene | undefined =>
  SCENES.find((name) => name === value);
