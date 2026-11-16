/**
 * Units are arbitrary but self-consistent: lengths in metres, mass density
 * chosen so the stress scales below sit well above the wall's own weight.
 * Strengths and rates were tuned by eye against the impact scenes, not
 * measured from real materials.
 */
export interface Material {
  label: string;
  /** Young's modulus. */
  youngs: number;
  poisson: number;
  density: number;
  /** Kirchhoff deviatoric stress at which plastic flow starts; Infinity = purely elastic. */
  yieldStress: number;
  /** Linear hardening modulus of the yield stress against accumulated plastic strain. */
  hardening: number;
  /** Tensile Cauchy stress at which damage starts to grow. */
  strength: number;
  /** Damage per second per unit of relative overstress. */
  damageRate: number;
  /** Damage gained per unit of plastic strain (ductile fracture). */
  plasticDamage: number;
  /** Fill colour, [r, g, b]. */
  color: readonly [number, number, number];
}

export const MATERIALS = {
  glass: {
    label: "Glass (brittle)",
    youngs: 3000,
    poisson: 0.25,
    density: 0.5,
    yieldStress: Infinity,
    hardening: 0,
    strength: 35,
    damageRate: 400,
    plasticDamage: 0,
    color: [140, 200, 220],
  },
  concrete: {
    label: "Concrete (quasi-brittle)",
    youngs: 3000,
    poisson: 0.2,
    density: 0.5,
    yieldStress: 90,
    hardening: 0,
    strength: 22,
    damageRate: 40,
    plasticDamage: 8,
    color: [160, 160, 155],
  },
  steel: {
    label: "Steel (ductile)",
    youngs: 3000,
    poisson: 0.3,
    density: 0.5,
    yieldStress: 30,
    hardening: 200,
    strength: 150,
    damageRate: 100,
    plasticDamage: 4,
    color: [120, 130, 150],
  },
  clay: {
    label: "Clay (soft, plastic)",
    youngs: 600,
    poisson: 0.35,
    density: 0.5,
    yieldStress: 4,
    hardening: 10,
    strength: 60,
    damageRate: 50,
    plasticDamage: 1.2,
    color: [190, 130, 90],
  },
} as const satisfies Record<string, Material>;

export type MaterialName = keyof typeof MATERIALS;

export const MATERIAL_NAMES = Object.keys(MATERIALS).filter(
  (name): name is MaterialName => name in MATERIALS,
);
