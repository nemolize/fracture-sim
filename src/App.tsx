import { useEffect, useRef, useState } from "react";

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

const PANEL_ID = "settings-panel";

const App = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<WorldStats>(INITIAL_STATS);
  const [physicsError, setPhysicsError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { gpu, unsupported } = useGpu();
  const motion = useMotion(settings);

  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setPanelOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-gray-50 p-4">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={panelOpen}
        aria-controls={PANEL_ID}
        className="absolute top-4 right-4 z-10 rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-gray-700"
        onClick={() => {
          setPanelOpen(!panelOpen);
        }}
      >
        Settings
      </button>
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
      {panelOpen ? (
        <div
          id={PANEL_ID}
          className="absolute top-16 right-4 z-10 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100%-2rem)] overflow-y-auto rounded-lg"
        >
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
        </div>
      ) : null}
    </main>
  );
};

export default App;
