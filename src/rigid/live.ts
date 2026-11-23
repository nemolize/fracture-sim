import { DEFAULT_FLOOR_MATERIAL } from "@/sim/floor-material";
import {
  DEFAULT_CRACK_ENERGY,
  DEFAULT_MATERIAL,
  type LiveMaterials,
  liveMaterials,
} from "@/sim/material";

export const live = (
  crackEnergy = DEFAULT_CRACK_ENERGY,
  patch: Partial<LiveMaterials> = {},
): LiveMaterials => ({
  ...liveMaterials({ floor: DEFAULT_FLOOR_MATERIAL, object: DEFAULT_MATERIAL }),
  crackEnergy,
  ...patch,
});
