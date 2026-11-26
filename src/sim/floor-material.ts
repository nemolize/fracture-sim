import { MATERIAL_PRESETS, type Surface } from "./material";

export const FLOOR_PRESETS = MATERIAL_PRESETS.map(
  ({ id, label, friction, restitution }) => ({
    id,
    label,
    friction,
    restitution,
  }),
);

export interface FloorMaterialSettings extends Surface {
  preset: (typeof FLOOR_PRESETS)[number]["id"] | "custom";
}

export const findFloorPreset = (id: string) =>
  FLOOR_PRESETS.find((preset) => preset.id === id);

const DEFAULT_PRESET = MATERIAL_PRESETS[4];
export const DEFAULT_FLOOR_MATERIAL: FloorMaterialSettings = {
  preset: DEFAULT_PRESET.id,
  friction: DEFAULT_PRESET.friction,
  restitution: DEFAULT_PRESET.restitution,
};

export const floorFromPreset = (
  preset: (typeof FLOOR_PRESETS)[number],
): FloorMaterialSettings => {
  return {
    preset: preset.id,
    friction: preset.friction,
    restitution: preset.restitution,
  };
};

/** Presets can share surface values; the preset already chosen wins while it still matches. */
export const matchFloorPreset = (
  floor: FloorMaterialSettings,
): FloorMaterialSettings => {
  const matches = (preset: (typeof FLOOR_PRESETS)[number]) =>
    preset.friction === floor.friction &&
    preset.restitution === floor.restitution;
  const kept = findFloorPreset(floor.preset);
  return {
    ...floor,
    preset:
      (kept !== undefined && matches(kept) ? kept : FLOOR_PRESETS.find(matches))
        ?.id ?? "custom",
  };
};
