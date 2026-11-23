import type { Surface } from "./material";

// Representative values; chosen empirically, no fixed source.
export const FLOOR_PRESETS = [
  { id: "default", label: "Default", friction: 0.5, restitution: 0 },
  { id: "concrete", label: "Concrete", friction: 0.7, restitution: 0.1 },
  { id: "wood", label: "Wood", friction: 0.5, restitution: 0.3 },
  { id: "steel", label: "Steel", friction: 0.4, restitution: 0.5 },
  { id: "rubber", label: "Rubber", friction: 1.2, restitution: 0.8 },
  { id: "ice", label: "Ice", friction: 0.05, restitution: 0.1 },
] as const;

export interface FloorMaterialSettings extends Surface {
  preset: (typeof FLOOR_PRESETS)[number]["id"] | "custom";
}

export const findFloorPreset = (id: string) =>
  FLOOR_PRESETS.find((preset) => preset.id === id);

const DEFAULT_PRESET = FLOOR_PRESETS[0];
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

export const matchFloorPreset = (
  floor: FloorMaterialSettings,
): FloorMaterialSettings => ({
  ...floor,
  preset:
    FLOOR_PRESETS.find(
      (preset) =>
        preset.friction === floor.friction &&
        preset.restitution === floor.restitution,
    )?.id ?? "custom",
});
