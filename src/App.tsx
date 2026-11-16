import { useState } from "react";

import { ControlPanel } from "@/ControlPanel";
import { FractureCanvas } from "@/FractureCanvas";
import { DEFAULT_SETTINGS, type Settings } from "@/settings";
import type { WorldStats } from "@/sim/world";

const INITIAL_STATS: WorldStats = {
  erodedFraction: 0,
  chunks: 1,
  maxPlasticStrain: 0,
};

const App = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<WorldStats>(INITIAL_STATS);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-gray-50 p-4 md:flex-row md:items-start">
      <div className="flex min-w-0 grow flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Fracture Sim</h1>
        <FractureCanvas
          settings={settings}
          paused={paused}
          resetToken={resetToken}
          onStats={setStats}
        />
      </div>
      <ControlPanel
        settings={settings}
        stats={stats}
        paused={paused}
        onChange={setSettings}
        onPausedChange={setPaused}
        onReset={() => {
          setResetToken((token) => token + 1);
        }}
      />
    </main>
  );
};

export default App;
