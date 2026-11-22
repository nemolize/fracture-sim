import type { WorldStats } from "@/rigid/types";

export const StatsReadout = ({ stats }: { stats: WorldStats }) => (
  <dl
    aria-label="Simulation statistics"
    className="pointer-events-none absolute top-3 left-3 grid grid-cols-[auto_auto] gap-x-3 rounded bg-gray-500/40 px-2 py-1 text-xs text-gray-800"
  >
    <dt>Bodies</dt>
    <dd className="text-right tabular-nums">{stats.bodies}</dd>
    <dt>Sleeping</dt>
    <dd className="text-right tabular-nums">{stats.sleeping}</dd>
    <dt>Physics step</dt>
    <dd className="text-right tabular-nums">{stats.stepMs.toFixed(2)} ms</dd>
  </dl>
);
