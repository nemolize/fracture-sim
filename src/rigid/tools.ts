import type { Vec2 } from "@/sim/vec2";

export type Tool = "grab" | "throw" | "blast";
export const TOOLS: readonly Tool[] = ["grab", "throw", "blast"];
export const TOOL_LABELS: Record<Tool, string> = {
  grab: "Grab",
  throw: "Throw ball",
  blast: "Blast",
};
export const TOOL_HINTS: Record<Tool, string> = {
  grab: "Press on a body to lift it. Drag and release to throw it.",
  throw:
    "Drag from a launch point toward the target. Longer drags launch faster balls.",
  blast: "Click to push bodies within 2 metres away from that point.",
};
export const BLAST_RADIUS = 2;
const MAX_TOOL_SPEED = 25;

export type ToolAction =
  | { type: "grab" | "move"; point: Vec2 }
  | { type: "release"; velocity: Vec2 }
  | { type: "throw"; point: Vec2; velocity: Vec2 }
  | { type: "blast"; point: Vec2 };

export const limitVelocity = (velocity: Vec2): Vec2 => {
  const speed = Math.hypot(velocity.x, velocity.y);
  const scale = speed > MAX_TOOL_SPEED ? MAX_TOOL_SPEED / speed : 1;
  return { x: velocity.x * scale, y: velocity.y * scale };
};
