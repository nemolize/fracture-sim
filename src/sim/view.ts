export type ViewMode = "material" | "damage" | "plastic" | "stress" | "chunks";

/** The position of a mode in this list is the id the render shader switches on. */
export const VIEW_MODES: readonly ViewMode[] = [
  "material",
  "damage",
  "plastic",
  "stress",
  "chunks",
];

export const VIEW_LABELS: Record<ViewMode, string> = {
  material: "Material",
  damage: "Damage",
  plastic: "Plastic strain",
  stress: "Tensile stress",
  chunks: "Pieces",
};

/** Plastic strain mapped to full colour. */
export const PLASTIC_FULL_SCALE = 0.3;

export const viewId = (view: ViewMode): number => VIEW_MODES.indexOf(view);
