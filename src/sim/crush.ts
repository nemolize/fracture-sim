import type { CrushProperties } from "./contact-stress";

const MAX_COMPRESSION = 0.95;
const BISECTIONS = 60;

const densifiedStrain = (foam: CrushProperties, modulusPa: number): number =>
  foam.densificationStrain - foam.plateauStressPa / modulusPa;

export const crushStress = (
  p: number,
  foam: CrushProperties,
  modulusPa: number,
): number =>
  foam.plateauStressPa +
  foam.densifiedModulusPa * Math.max(0, p - densifiedStrain(foam, modulusPa));

export const reloadModulus = (
  p: number,
  foam: CrushProperties,
  modulusPa: number,
): number =>
  modulusPa +
  (foam.densifiedModulusPa - modulusPa) *
    Math.min(p / densifiedStrain(foam, modulusPa), 1);

export const segmentStiffness = (
  p: number,
  foam: CrushProperties,
  modulusPa: number,
  area: number,
  depth: number,
): number => (area * reloadModulus(p, foam, modulusPa)) / depth;

export interface CrushResult {
  p: number;
  dissipated: number;
}

export const crushSegment = (
  p0: number,
  work: number,
  foam: CrushProperties,
  modulusPa: number,
  area: number,
  depth: number,
): CrushResult => {
  const volume = area * depth;
  const density = work / volume;
  const reload = reloadModulus(p0, foam, modulusPa);
  const stored = (p: number): number =>
    crushStress(p, foam, modulusPa) ** 2 / (2 * reload);
  const plastic = (p: number): number => {
    const start = densifiedStrain(foam, modulusPa);
    const flat =
      foam.plateauStressPa * (Math.min(p, start) - Math.min(p0, start));
    const hardening =
      (foam.densifiedModulusPa *
        (Math.max(0, p - start) ** 2 - Math.max(0, p0 - start) ** 2)) /
      2;
    return flat + hardening;
  };
  const total = (p: number): number => stored(p) + plastic(p);
  if (density <= total(p0)) return { p: p0, dissipated: 0 };
  let low = p0;
  let high = MAX_COMPRESSION;
  if (total(high) <= density) low = high;
  else
    for (let i = 0; i < BISECTIONS; i++) {
      const middle = (low + high) / 2;
      if (total(middle) < density) low = middle;
      else high = middle;
    }
  return { p: low, dissipated: volume * plastic(low) };
};
