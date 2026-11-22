import type { FloorMaterialSettings } from "./floor-material";
import { MIN_FRAGMENT_AREA } from "./fracture";

export interface Surface {
  friction: number;
  restitution: number;
}

export const BOUNDARY_SURFACE: Surface = { friction: 0.5, restitution: 0 };

export const SURFACE_RANGES = {
  friction: { min: 0, max: 2, step: 0.01 },
  restitution: { min: 0, max: 1, step: 0.01 },
} as const;

export const validateSurface = (surface: Surface): void => {
  for (const key of ["friction", "restitution"] as const) {
    const { min, max } = SURFACE_RANGES[key];
    if (
      !Number.isFinite(surface[key]) ||
      surface[key] < min ||
      surface[key] > max
    )
      throw new Error(`Invalid material setting: ${key}`);
  }
};

// Representative values; chosen empirically, no fixed source except the
// fracture energies (docs/material-presets.md).
export const MATERIAL_PRESETS = [
  {
    id: "glass",
    label: "Glass",
    fractureEnergy: 7,
    density: 2500,
    friction: 0.5,
    restitution: 0,
  },
  {
    id: "ice",
    label: "Ice (−13°C)",
    fractureEnergy: 1.5,
    density: 917,
    friction: 0.1,
    restitution: 0.05,
  },
  {
    id: "pmma",
    label: "Acrylic (PMMA)",
    fractureEnergy: 500,
    density: 1180,
    friction: 0.4,
    restitution: 0.3,
  },
  {
    id: "polystyrene",
    label: "Polystyrene",
    fractureEnergy: 400,
    density: 1050,
    friction: 0.4,
    restitution: 0.3,
  },
] as const;

export interface MaterialSettings extends Surface {
  preset: (typeof MATERIAL_PRESETS)[number]["id"] | "custom";
  /** Critical fracture energy Gc, J/m². */
  fractureEnergy: number;
  /** Volumetric density, kg/m³. */
  density: number;
  thicknessMm: number;
  /** Smallest fragment area at world scale ×1, m². */
  minFragmentArea: number;
}

export const MATERIAL_RANGES = {
  density: { min: 500, max: 20_000, step: 1 },
  thicknessMm: { min: 0.1, max: 100, step: 0.1 },
} as const;
export const FRACTURE_ENERGY_LOG_RANGE = {
  min: -1,
  max: 6,
  step: 0.01,
} as const;

export const MIN_FRAGMENT_AREA_LOG_RANGE = {
  min: -5,
  max: -2,
  step: 0.01,
} as const;

export const AREAL_DENSITY_RANGE = {
  min: (MATERIAL_RANGES.density.min * MATERIAL_RANGES.thicknessMm.min) / 1000,
  max: (MATERIAL_RANGES.density.max * MATERIAL_RANGES.thicknessMm.max) / 1000,
};

export const findMaterialPreset = (id: string) =>
  MATERIAL_PRESETS.find((preset) => preset.id === id);

const GLASS = MATERIAL_PRESETS[0];
export const DEFAULT_MATERIAL_PRESET = GLASS;
export const DEFAULT_MATERIAL: MaterialSettings = {
  preset: GLASS.id,
  fractureEnergy: GLASS.fractureEnergy,
  density: GLASS.density,
  friction: GLASS.friction,
  restitution: GLASS.restitution,
  thicknessMm: 10,
  minFragmentArea: MIN_FRAGMENT_AREA,
};

export const materialFromPreset = (
  preset: (typeof MATERIAL_PRESETS)[number],
  current: Pick<MaterialSettings, "thicknessMm" | "minFragmentArea">,
): MaterialSettings => {
  return {
    preset: preset.id,
    fractureEnergy: preset.fractureEnergy,
    density: preset.density,
    friction: preset.friction,
    restitution: preset.restitution,
    thicknessMm: current.thicknessMm,
    minFragmentArea: current.minFragmentArea,
  };
};

/** The slider grid never lands exactly on a preset's energy, so a position within half a step of it snaps to it. */
export const fractureEnergyAt = (position: number): number =>
  MATERIAL_PRESETS.find(
    (preset) =>
      Math.abs(Math.log10(preset.fractureEnergy) - position) <
      FRACTURE_ENERGY_LOG_RANGE.step / 2,
  )?.fractureEnergy ?? 10 ** position;

export const matchPreset = (material: MaterialSettings): MaterialSettings => ({
  ...material,
  preset:
    MATERIAL_PRESETS.find(
      (preset) =>
        preset.fractureEnergy === material.fractureEnergy &&
        preset.density === material.density &&
        preset.friction === material.friction &&
        preset.restitution === material.restitution,
    )?.id ?? "custom",
});

export const isCrackEnergy = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export const arealDensity = (material: MaterialSettings): number =>
  (material.density * material.thicknessMm) / 1000;

export const validateMaterial = (material: MaterialSettings): void => {
  validateSurface(material);
  const { min, max } = AREAL_DENSITY_RANGE;
  const areal = arealDensity(material);
  if (!Number.isFinite(areal) || areal < min || areal > max)
    throw new Error("Invalid material setting: areal density");
  if (!isCrackEnergy(material.fractureEnergy))
    throw new Error("Fracture energy must be positive and finite");
};

export const crackEnergy = (material: MaterialSettings): number => {
  const result = material.fractureEnergy * (material.thicknessMm / 1000);
  if (!isCrackEnergy(material.thicknessMm) || !isCrackEnergy(result))
    throw new Error("Thickness and crack energy must be positive and finite");
  return result;
};

export const DEFAULT_CRACK_ENERGY = crackEnergy(DEFAULT_MATERIAL);

export const liveMaterials = (materials: WorldMaterials): LiveMaterials => ({
  crackEnergy: crackEnergy(materials.object),
  minFragmentArea: materials.object.minFragmentArea,
  floor: materials.floor,
  object: materials.object,
});

export interface WorldMaterials {
  floor: FloorMaterialSettings;
  object: MaterialSettings;
}

export interface LiveMaterials {
  crackEnergy: number;
  minFragmentArea: number;
  floor: Surface;
  object: Surface;
}
