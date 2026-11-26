import type { Vec2 } from "./vec2";

export interface StrengthModel {
  youngModulusPa: number;
  tensileStrengthPa: number;
  thicknessM: number;
  flawLengthM?: number;
  crush: CrushProperties | null;
}

export interface CrushProperties {
  plateauStressPa: number;
  densificationStrain: number;
  densifiedModulusPa: number;
  crushDepthM: number;
}

export interface ContactLoad {
  impulse: number;
  effectiveMass: number;
  patchWidth: number;
  bodyWidth: number;
  bodyDepth: number;
}

// Empirical concentration factors fitted against the glass drop and throw tests, no fixed source.
export const FLAT_CONCENTRATION = 6;
export const POINT_CONCENTRATION = 60;
export const MIN_PATCH_FRACTION = 0.01;

const loadedDepth = (load: ContactLoad): number =>
  Math.min(load.bodyDepth, load.patchWidth);

export const contactStiffness = (
  youngModulusPa: number,
  thicknessM: number,
  load: ContactLoad,
): number =>
  (youngModulusPa * thicknessM * load.patchWidth) / loadedDepth(load);

export const peakForce = (
  impulse: number,
  stiffness: number,
  effectiveMass: number,
): number => (impulse / 2) * Math.sqrt(stiffness / effectiveMass);

export const tensionConcentration = (
  patchWidth: number,
  bodyWidth: number,
): number => {
  const coverage = Math.min(1, patchWidth / bodyWidth);
  return (
    FLAT_CONCENTRATION +
    (POINT_CONCENTRATION - FLAT_CONCENTRATION) * (1 - coverage)
  );
};

export const tensileStress = (
  load: ContactLoad,
  stiffness: number,
  thicknessM: number,
): number =>
  (tensionConcentration(load.patchWidth, load.bodyWidth) *
    peakForce(load.impulse, stiffness, load.effectiveMass)) /
  (thicknessM * load.patchWidth);

export const griffithStress = (
  youngModulusPa: number,
  fractureEnergy: number,
  flawLengthM: number,
): number =>
  Math.sqrt((2 * youngModulusPa * fractureEnergy) / (Math.PI * flawLengthM));

export const localElasticEnergy = (
  stress: number,
  youngModulusPa: number,
  volume: number,
): number => (stress * stress * volume) / (2 * youngModulusPa);

export const usableCrackEnergy = (
  load: ContactLoad,
  strength: StrengthModel,
  fractureEnergy: number,
  lostEnergy: number,
): number => {
  const { youngModulusPa, thicknessM } = strength;
  const stress = tensileStress(
    load,
    contactStiffness(youngModulusPa, thicknessM, load),
    thicknessM,
  );
  const threshold = Math.max(
    strength.tensileStrengthPa,
    strength.flawLengthM === undefined
      ? 0
      : griffithStress(youngModulusPa, fractureEnergy, strength.flawLengthM),
  );
  if (!(stress >= threshold)) return 0;
  const volume = thicknessM * load.patchWidth * loadedDepth(load);
  return Math.min(
    lostEnergy,
    localElasticEnergy(stress, youngModulusPa, volume),
  );
};

export interface Extent {
  width: number;
  depth: number;
}

export const ringExtent = (ring: readonly Vec2[], normal: Vec2): Extent => {
  const along = ring.map((p) => p.x * normal.x + p.y * normal.y);
  const across = ring.map((p) => p.x * -normal.y + p.y * normal.x);
  return {
    width: Math.max(...across) - Math.min(...across),
    depth: Math.max(...along) - Math.min(...along),
  };
};

const sameCrush = (
  a: CrushProperties | null,
  b: CrushProperties | null,
): boolean => {
  if (a === null || b === null) return a === b;
  return (
    a.plateauStressPa === b.plateauStressPa &&
    a.densificationStrain === b.densificationStrain &&
    a.densifiedModulusPa === b.densifiedModulusPa &&
    a.crushDepthM === b.crushDepthM
  );
};

export const sameStrength = (
  a: StrengthModel | undefined,
  b: StrengthModel | undefined,
): boolean => {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.youngModulusPa === b.youngModulusPa &&
    a.tensileStrengthPa === b.tensileStrengthPa &&
    a.thicknessM === b.thicknessM &&
    a.flawLengthM === b.flawLengthM &&
    sameCrush(a.crush, b.crush)
  );
};
