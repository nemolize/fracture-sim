import { DEFAULT_FLOOR_MATERIAL } from "@/sim/floor-material";
import {
  DEFAULT_CRACK_ENERGY,
  DEFAULT_MATERIAL,
  type LiveMaterials,
} from "@/sim/material";

export const live = (
  crackEnergy = DEFAULT_CRACK_ENERGY,
  patch: Partial<LiveMaterials> = {},
): LiveMaterials => ({
  crackEnergy,
  minFragmentArea: DEFAULT_MATERIAL.minFragmentArea,
  floor: DEFAULT_FLOOR_MATERIAL,
  object: DEFAULT_MATERIAL,
  ...patch,
});
