import { formatNumber } from "@/format";
import type { WorldStats } from "@/rigid/types";
import {
  arealDensity,
  crackEnergy,
  type MaterialSettings,
} from "@/sim/material";
import { useFrameRate } from "@/useFrameRate";

interface Props {
  stats: WorldStats;
  material: MaterialSettings;
}

export const StatsReadout = ({ stats, material }: Props) => {
  const fps = useFrameRate();
  return (
    <dl
      aria-label="Simulation statistics"
      className="pointer-events-none grid min-w-48 grid-cols-[1fr_auto] gap-x-3 rounded bg-white/60 px-2 py-1 text-xs text-gray-800 backdrop-blur-md"
    >
      <dt>Frame rate</dt>
      <dd className="text-right tabular-nums">
        {fps === null ? "–" : `${fps.toFixed(0)} fps`}
      </dd>
      <dt>Bodies</dt>
      <dd className="text-right tabular-nums">{stats.bodies}</dd>
      <dt>Sleeping</dt>
      <dd className="text-right tabular-nums">{stats.sleeping}</dd>
      <dt>Physics step</dt>
      <dd className="text-right tabular-nums">{stats.stepMs.toFixed(2)} ms</dd>
      <dt>Areal density</dt>
      <dd className="text-right tabular-nums">
        {formatNumber(arealDensity(material))} kg/m²
      </dd>
      <dt>Crack energy</dt>
      <dd className="text-right tabular-nums">
        {formatNumber(crackEnergy(material))} J/m
      </dd>
    </dl>
  );
};
