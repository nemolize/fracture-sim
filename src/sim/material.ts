export const DEFAULT_FRACTURE_TOUGHNESS = 1200;
export const MIN_FRACTURE_TOUGHNESS = 1;

export const isFractureToughness = (value: number): boolean =>
  Number.isFinite(value) && value >= MIN_FRACTURE_TOUGHNESS;
