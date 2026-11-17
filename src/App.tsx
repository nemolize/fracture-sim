import { useState } from "react";

import { ControlPanel } from "@/ControlPanel";
import { FractureCanvas } from "@/FractureCanvas";
import { useGpu } from "@/gpu/useGpu";
import { DEFAULT_SETTINGS, type Settings } from "@/settings";
import type { WorldStats } from "@/sim/stats";

const INITIAL_STATS: WorldStats = {
  erodedFraction: 0,
  chunks: 1,
  maxPlasticStrain: 0,
};

const Notice = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section
    role="alert"
    className="flex aspect-[10/5.6] w-full flex-col items-center justify-center gap-2 rounded-lg bg-white p-6 text-center shadow"
  >
    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    <p className="text-sm text-gray-600">{children}</p>
  </section>
);

const App = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<WorldStats>(INITIAL_STATS);
  const { gpu, fail } = useGpu();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-gray-50 p-4 md:flex-row md:items-start">
      <div className="flex min-w-0 grow flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Fracture Sim</h1>
        {gpu.status === "ready" ? (
          <FractureCanvas
            device={gpu.device}
            settings={settings}
            paused={paused}
            resetToken={resetToken}
            onStats={setStats}
            onFatal={fail}
          />
        ) : null}
        {gpu.status === "unavailable" ? (
          <Notice title="WebGPU is required">
            This simulator runs on the GPU and has no fallback. Open it in a
            browser with WebGPU enabled. ({gpu.reason})
          </Notice>
        ) : null}
        {gpu.status === "lost" ? (
          <Notice title="The GPU stopped">
            {gpu.message} Reload the page to start again.
          </Notice>
        ) : null}
      </div>
      <ControlPanel
        settings={settings}
        stats={stats}
        paused={paused}
        locked={gpu.status !== "ready"}
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
