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
  const popupRef = useRef<HTMLDivElement>(null);
  const { gpu, unsupported } = useGpu();
  const motion = useMotion(settings);
  const locked = gpu.status !== "ready" || physicsError !== null;

  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setPanelOpen(false);
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent): void => {
      const inside = event
        .composedPath()
        .some(
          (node) => node === popupRef.current || node === toggleRef.current,
        );
      if (inside) return;
      setPanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [panelOpen]);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 bg-gray-50 p-4">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          type="button"
          className="rounded bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow hover:bg-gray-100"
          onClick={() => {
            setPaused(!paused);
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          disabled={locked}
          className="rounded bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow hover:bg-gray-100 disabled:opacity-50"
          onClick={() => {
            setResetToken((token) => token + 1);
          }}
        >
          Reset
        </button>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={panelOpen}
          aria-controls={PANEL_ID}
          className="rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-gray-700"
          onClick={() => {
            setPanelOpen(!panelOpen);
          }}
        >
          Settings
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="mt-10 text-2xl font-bold text-gray-800 sm:mt-0">
          Fracture Sim
        </h1>
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
          ref={popupRef}
          id={PANEL_ID}
          className="absolute top-16 right-4 z-10 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100%-2rem)] overflow-y-auto rounded-lg"
        >
          <ControlPanel
            settings={settings}
            stats={stats}
            paused={paused}
            locked={locked}
            motion={motion}
            onChange={setSettings}
          />
        </div>
      ) : null}
    </main>
  );
};

export default App;
