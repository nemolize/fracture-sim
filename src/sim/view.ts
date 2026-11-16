export type ViewMode = "material" | "damage" | "plastic" | "stress" | "chunks";

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

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Dark blue through red to yellow; `t` is clamped to 0..1. */
export const heat = (t: number): string => {
  const v = clamp01(t);
  const r = Math.round(255 * clamp01(v * 2));
  const g = Math.round(255 * clamp01(v * 2 - 1));
  const b = Math.round(160 * (1 - v));
  return `rgb(${String(r)} ${String(g)} ${String(b)})`;
};

/** Stable distinct colour per piece id (golden-angle hue steps). */
export const pieceColor = (id: number): string =>
  `hsl(${String((id * 137.508) % 360)} 55% 60%)`;

export const shade = (
  base: readonly [number, number, number],
  brightness: number,
): string => {
  const [r, g, b] = base.map((c) => Math.round(Math.min(c * brightness, 255)));
  return `rgb(${String(r)} ${String(g)} ${String(b)})`;
};
