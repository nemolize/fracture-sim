import { wgslConstants } from "./constants";
import balls from "./shaders/balls.wgsl?raw";
import common from "./shaders/common.wgsl?raw";
import elements from "./shaders/elements.wgsl?raw";
import interact from "./shaders/interact.wgsl?raw";
import nodes from "./shaders/nodes.wgsl?raw";
import render from "./shaders/render.wgsl?raw";

const header = `${wgslConstants()}\n${common}\n`;

/** Full WGSL source of each module: shared constants and records, then its own passes. */
export const SHADERS = {
  elements: header + elements,
  nodes: header + nodes,
  balls: header + balls,
  interact: header + interact,
  render: header + render,
} as const;
