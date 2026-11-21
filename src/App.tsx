import { useState } from "react";

import { ControlPanel } from "@/ControlPanel";
import { FractureCanvas } from "@/FractureCanvas";
import { useGpu } from "@/gpu/useGpu";
import type { WorldStats } from "@/rigid/types";
import { DEFAULT_SETTINGS, type Settings } from "@/settings";
import { useMotion } from "@/useMotion";

const INITIAL_STATS: WorldStats = {
  mass: 0,
  bodies: 0,
  sleeping: 0,
  stepMs: 0,
  time: 0,
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
  const [physicsError, setPhysicsError] = useState<string | null>(null);
  const { gpu, unsupported } = useGpu();
  const motion = useMotion(settings);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-gray-50 p-4 md:flex-row md:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Fracture Sim</h1>
        {gpu.status === "ready" && physicsError === null ? (
          <FractureCanvas
            device={gpu.device}
            settings={settings}
            tracker={motion.tracker}
            paused={paused}
            resetToken={resetToken}
            onStats={setStats}
            onPhysicsError={setPhysicsError}
            onContextUnavailable={unsupported}
          />
        ) : null}
        {physicsError !== null ? (
          <Notice title="The physics stopped">
            {physicsError} Reload the page to start again.
          </Notice>
        ) : null}
        {gpu.status === "unavailable" ? (
          <Notice title="WebGPU is required">
            This simulator uses WebGPU for rendering. Open it in a browser with
            WebGPU enabled. ({gpu.reason})
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
        locked={gpu.status !== "ready" || physicsError !== null}
        motion={motion}
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
