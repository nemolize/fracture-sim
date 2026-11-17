import { MATERIAL_NAMES, type MaterialName } from "@/sim/materials";
import { RESOLUTION_NAMES, type ResolutionName } from "@/sim/resolution";
import { SCENE_NAMES, type SceneName } from "@/sim/scenes";
import { VIEW_MODES, type ViewMode } from "@/sim/view";

export type Tool = "throw" | "pull" | "blast";

export const TOOLS: readonly Tool[] = ["throw", "pull", "blast"];

export const TOOL_LABELS: Record<Tool, string> = {
  throw: "Throw ball",
  pull: "Pull",
  blast: "Blast",
};

export const TOOL_HINTS: Record<Tool, string> = {
  throw:
    "Drag on the canvas: the ball flies the way you drag, faster the longer the drag.",
  pull: "Press on the body and drag to tear it apart.",
  blast: "Click to push everything nearby away from that point.",
};

export interface Settings {
  scene: SceneName;
  material: MaterialName;
  resolution: ResolutionName;
  view: ViewMode;
  tool: Tool;
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
  scene: "wall",
  material: "concrete",
  resolution: "standard",
  view: "material",
  tool: "throw",
  speed: 0.5,
  inertiaScale: 1,
  inertiaCap: 20,
  tiltSmoothing: 0.1,
};

/** Narrowing helpers for values read back from `<select>` elements. */
export const asScene = (value: string): SceneName | undefined =>
  SCENE_NAMES.find((name) => name === value);
export const asMaterial = (value: string): MaterialName | undefined =>
  MATERIAL_NAMES.find((name) => name === value);
export const asResolution = (value: string): ResolutionName | undefined =>
  RESOLUTION_NAMES.find((name) => name === value);
export const asView = (value: string): ViewMode | undefined =>
  VIEW_MODES.find((name) => name === value);
