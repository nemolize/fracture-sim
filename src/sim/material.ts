import { MIN_FRAGMENT_AREA } from "./fracture";

export const MATERIAL_PRESETS = [
  { id: "glass", label: "Glass", fractureEnergy: 7 },
  { id: "ice", label: "Ice (−13°C)", fractureEnergy: 1.5 },
  { id: "pmma", label: "Acrylic (PMMA)", fractureEnergy: 500 },
  { id: "polystyrene", label: "Polystyrene", fractureEnergy: 400 },
] as const;

type MaterialPreset = (typeof MATERIAL_PRESETS)[number]["id"];
export interface MaterialSettings {
  preset: MaterialPreset | "custom";
  customFractureEnergy: number;
  thicknessMm: number;
  minFragmentArea: number;
}

export const DEFAULT_MATERIAL: MaterialSettings = {
  preset: "glass",
  customFractureEnergy: 1_000_000,
  thicknessMm: 10,
  minFragmentArea: MIN_FRAGMENT_AREA,
};

export const findMaterialPreset = (id: string) =>
  MATERIAL_PRESETS.find((preset) => preset.id === id);

export const isCrackEnergy = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export const materialFractureEnergy = (material: MaterialSettings): number => {
  const energy =
    material.preset === "custom"
      ? material.customFractureEnergy
      : findMaterialPreset(material.preset)?.fractureEnergy;
  if (energy === undefined || !isCrackEnergy(energy))
    throw new Error("Fracture energy must be positive and finite");
  return energy;
};

export const crackEnergy = (material: MaterialSettings): number => {
  const result =
    materialFractureEnergy(material) * (material.thicknessMm / 1000);
  if (!isCrackEnergy(material.thicknessMm) || !isCrackEnergy(result))
    throw new Error("Thickness and crack energy must be positive and finite");
  return result;
};

export const DEFAULT_CRACK_ENERGY = crackEnergy(DEFAULT_MATERIAL);
