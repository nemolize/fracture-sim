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
  // Chosen empirically, no fixed source.
  finest: { label: "Finest (0.03 m cells)", cell: 0.03 },
} as const satisfies Record<ResolutionName, Resolution>;

export const RESOLUTION_NAMES = Object.keys(RESOLUTIONS).filter(
  (name): name is ResolutionName => name in RESOLUTIONS,
);

/** Fixed explicit step that is stable for the stiffest material on the standard mesh. */
const STANDARD_DT = 0.0003;

/** The stable step scales with the cell size: wave crossing time and the node-level contact spring both do. */
export const timeStep = (cell: number): number => (STANDARD_DT * cell) / CELL;
