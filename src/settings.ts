import { MATERIAL_NAMES, type MaterialName } from "@/sim/materials";
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
  view: ViewMode;
  tool: Tool;
  /** Simulated seconds per real second. */
  speed: number;
}

export const DEFAULT_SETTINGS: Settings = {
  scene: "wall",
  material: "concrete",
  view: "material",
  tool: "throw",
  speed: 0.5,
};

/** Narrowing helpers for values read back from `<select>` elements. */
export const asScene = (value: string): SceneName | undefined =>
  SCENE_NAMES.find((name) => name === value);
export const asMaterial = (value: string): MaterialName | undefined =>
  MATERIAL_NAMES.find((name) => name === value);
export const asView = (value: string): ViewMode | undefined =>
  VIEW_MODES.find((name) => name === value);
