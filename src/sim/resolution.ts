import { CELL } from "./scenes";

export type ResolutionName = "standard" | "fine" | "finest";

interface Resolution {
  label: string;
  /** Edge length of one mesh cell in metres. */
  cell: number;
}

export const RESOLUTIONS = {
  standard: { label: "Standard (0.10 m cells)", cell: CELL },
  fine: { label: "Fine (0.05 m cells)", cell: 0.05 },
  // (0.1 / 0.03)^2 = 11 times the triangles of the standard mesh; chosen
  // empirically, no fixed source.
  finest: { label: "Finest (0.03 m cells)", cell: 0.03 },
} as const satisfies Record<ResolutionName, Resolution>;

export const RESOLUTION_NAMES = Object.keys(RESOLUTIONS).filter(
  (name): name is ResolutionName => name in RESOLUTIONS,
);

/** Fixed explicit step that is stable for the stiffest material on the standard mesh. */
const STANDARD_DT = 0.0003;

/**
 * The explicit step is limited by the time a stress wave needs to cross one
 * cell, and by the node-level contact spring, whose stiffness is fixed while
 * the node mass falls with the cell area; both give a step proportional to the
 * cell size.
 */
export const timeStep = (cell: number): number => (STANDARD_DT * cell) / CELL;
