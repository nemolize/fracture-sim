import type { CrushProperties, StrengthModel } from "./contact-stress";
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

// Chosen empirically against the drop tests, no fixed source.
const BULK_DISSIPATION_J_PER_KG = 7;

// Representative values, chosen empirically; the sourced fracture energies are
// listed in docs/material-presets.md.
export const MATERIAL_PRESETS = [
  {
    id: "glass",
    label: "Glass",
    fractureEnergy: 7,
    density: 2500,
    friction: 0.5,
    restitution: 0,
    youngModulusPa: 70_000_000_000,
    tensileStrengthPa: 10_000_000,
    crush: null,
  },
  {
    id: "ice",
    label: "Ice (−13°C)",
    fractureEnergy: 1.5,
    density: 917,
    friction: 0.1,
    restitution: 0.05,
    youngModulusPa: 9_000_000_000,
    tensileStrengthPa: 1_500_000,
    crush: null,
  },
  {
    id: "pmma",
    label: "Acrylic (PMMA)",
    fractureEnergy: 500,
    density: 1180,
    friction: 0.4,
    restitution: 0.3,
    youngModulusPa: 3_000_000_000,
    tensileStrengthPa: 70_000_000,
    crush: null,
  },
  {
    id: "polystyrene",
    label: "Polystyrene",
    fractureEnergy: 400,
    density: 1050,
    friction: 0.4,
    restitution: 0.3,
    youngModulusPa: 3_300_000_000,
    tensileStrengthPa: 45_000_000,
    bulkDissipationJPerKg: BULK_DISSIPATION_J_PER_KG,
    crush: null,
  },
  {
    id: "concrete",
    label: "Concrete",
    fractureEnergy: 100,
    density: 2400,
    friction: 0.7,
    restitution: 0.1,
    youngModulusPa: 30_000_000_000,
    tensileStrengthPa: 3_000_000,
    crush: null,
  },
  {
    id: "wood",
    label: "Wood",
    fractureEnergy: 120,
    density: 600,
    friction: 0.5,
    restitution: 0.3,
    youngModulusPa: 10_000_000_000,
    tensileStrengthPa: 40_000_000,
    crush: null,
  },
  {
    id: "steel",
    label: "Steel",
    fractureEnergy: 12_000,
    density: 7850,
    friction: 0.4,
    restitution: 0.5,
    youngModulusPa: 200_000_000_000,
    tensileStrengthPa: 400_000_000,
    bulkDissipationJPerKg: BULK_DISSIPATION_J_PER_KG,
    crush: null,
  },
  {
    id: "rubber",
    label: "Rubber",
    fractureEnergy: 13_000,
    density: 1100,
    friction: 1.2,
    restitution: 0.8,
    youngModulusPa: 10_000_000,
    tensileStrengthPa: 15_000_000,
    crush: null,
  },
  {
    id: "eps",
    label: "Expanded polystyrene (foam)",
    fractureEnergy: 100,
    density: 20,
    friction: 0.6,
    restitution: 0.1,
    youngModulusPa: 5_000_000,
    tensileStrengthPa: 200_000,
    crush: {
      plateauStressPa: 100_000,
      densificationStrain: 0.6,
      densifiedModulusPa: 20_000_000,
      crushDepthM: 0.02,
    },
  },
] as const;

export interface MaterialSettings extends Surface {
  preset: (typeof MATERIAL_PRESETS)[number]["id"] | "custom";
  /** Critical fracture energy Gc, J/m². */
  fractureEnergy: number;
  /** Volumetric density, kg/m³. */
  density: number;
  youngModulusPa: number;
  tensileStrengthPa: number;
  bulkDissipationJPerKg: number;
  crush: CrushProperties | null;
  thicknessMm: number;
  /** Smallest fragment area at world scale ×1, m². */
  minFragmentArea: number;
}

export const MATERIAL_RANGES = {
  density: { min: 10, max: 20_000, step: 1 },
  thicknessMm: { min: 0.1, max: 100, step: 0.1 },
} as const;
export const FRACTURE_ENERGY_LOG_RANGE = {
  min: -1,
  max: 6,
  step: 0.01,
} as const;

export const MIN_FRAGMENT_AREA_LOG_RANGE = {
  min: -3,
  max: -1,
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
  youngModulusPa: GLASS.youngModulusPa,
  tensileStrengthPa: GLASS.tensileStrengthPa,
  bulkDissipationJPerKg: 0,
  crush: GLASS.crush,
  friction: GLASS.friction,
  restitution: GLASS.restitution,
  thicknessMm: 10,
  minFragmentArea: MIN_FRAGMENT_AREA,
};

const presetBulkDissipation = (
  preset: (typeof MATERIAL_PRESETS)[number],
): number =>
  "bulkDissipationJPerKg" in preset ? preset.bulkDissipationJPerKg : 0;

export const materialFromPreset = (
  preset: (typeof MATERIAL_PRESETS)[number],
  current: Pick<MaterialSettings, "thicknessMm" | "minFragmentArea">,
): MaterialSettings => {
  return {
    preset: preset.id,
    fractureEnergy: preset.fractureEnergy,
    density: preset.density,
    youngModulusPa: preset.youngModulusPa,
    tensileStrengthPa: preset.tensileStrengthPa,
    bulkDissipationJPerKg: presetBulkDissipation(preset),
    crush: preset.crush,
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
        preset.youngModulusPa === material.youngModulusPa &&
        preset.tensileStrengthPa === material.tensileStrengthPa &&
        presetBulkDissipation(preset) === material.bulkDissipationJPerKg &&
        preset.friction === material.friction &&
        preset.restitution === material.restitution,
    )?.id ?? "custom",
});

export const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export const arealDensity = (material: MaterialSettings): number =>
  (material.density * material.thicknessMm) / 1000;

export const validateMaterial = (material: MaterialSettings): void => {
  validateSurface(material);
  const { min, max } = AREAL_DENSITY_RANGE;
  const areal = arealDensity(material);
  if (!Number.isFinite(areal) || areal < min || areal > max)
    throw new Error("Invalid material setting: areal density");
  if (!isPositiveFinite(material.fractureEnergy))
    throw new Error("Fracture energy must be positive and finite");
  if (
    !isPositiveFinite(material.youngModulusPa) ||
    !isPositiveFinite(material.tensileStrengthPa)
  )
    throw new Error(
      "Young's modulus and tensile strength must be positive and finite",
    );
  if (
    !Number.isFinite(material.bulkDissipationJPerKg) ||
    material.bulkDissipationJPerKg < 0
  )
    throw new Error("Bulk dissipation must be non-negative and finite");
};

export const crackEnergy = (material: MaterialSettings): number => {
  const result = material.fractureEnergy * (material.thicknessMm / 1000);
  if (!isPositiveFinite(material.thicknessMm) || !isPositiveFinite(result))
    throw new Error("Thickness and crack energy must be positive and finite");
  return result;
};

export const DEFAULT_CRACK_ENERGY = crackEnergy(DEFAULT_MATERIAL);

const strengthModel = (material: MaterialSettings): StrengthModel => ({
  youngModulusPa: material.youngModulusPa,
  tensileStrengthPa: material.tensileStrengthPa,
  thicknessM: material.thicknessMm / 1000,
  bulkDissipationJPerKg: material.bulkDissipationJPerKg,
  crush: material.crush,
});

export const liveMaterials = (materials: WorldMaterials): LiveMaterials => ({
  crackEnergy: crackEnergy(materials.object),
  fractureEnergy: materials.object.fractureEnergy,
  strength: strengthModel(materials.object),
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
  fractureEnergy: number;
  strength: StrengthModel;
  minFragmentArea: number;
  floor: Surface;
  object: Surface;
}
