import type { ReactNode } from "react";

import {
  asMaterial,
  asResolution,
  asScene,
  asView,
  type Settings,
  TOOL_HINTS,
  TOOL_LABELS,
  TOOLS,
} from "@/settings";
import { MATERIAL_NAMES, MATERIALS } from "@/sim/materials";
import { RESOLUTION_NAMES, RESOLUTIONS } from "@/sim/resolution";
import { SCENE_NAMES } from "@/sim/scenes";
import type { WorldStats } from "@/sim/stats";
import { VIEW_LABELS, VIEW_MODES } from "@/sim/view";
import { cn } from "@/utils/cn";

interface Props {
  settings: Settings;
  stats: WorldStats;
  paused: boolean;
  /** Reset and the settings that rebuild the solver stay off once WebGPU is gone. */
  locked: boolean;
  onChange: (next: Settings) => void;
  onPausedChange: (paused: boolean) => void;
  onReset: () => void;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
    {label}
    {children}
  </label>
);

const SELECT_CLASS =
  "rounded border border-gray-300 bg-white p-1.5 font-normal";

export const ControlPanel = ({
  settings,
  stats,
  paused,
  locked,
  onChange,
  onPausedChange,
  onReset,
}: Props) => (
  <aside className="flex w-full flex-col gap-4 rounded-lg bg-white p-4 shadow md:w-72">
    <div className="grid grid-cols-1 gap-3">
      <Field label="Scene">
        <select
          className={SELECT_CLASS}
          disabled={locked}
          value={settings.scene}
          onChange={(event) => {
            const scene = asScene(event.target.value);
            if (scene !== undefined) onChange({ ...settings, scene });
          }}
        >
          {SCENE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Material">
        <select
          className={SELECT_CLASS}
          disabled={locked}
          value={settings.material}
          onChange={(event) => {
            const material = asMaterial(event.target.value);
            if (material !== undefined) onChange({ ...settings, material });
          }}
        >
          {MATERIAL_NAMES.map((name) => (
            <option key={name} value={name}>
              {MATERIALS[name].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Mesh resolution">
        <select
          className={SELECT_CLASS}
          disabled={locked}
          value={settings.resolution}
          onChange={(event) => {
            const resolution = asResolution(event.target.value);
            if (resolution !== undefined) onChange({ ...settings, resolution });
          }}
        >
          {RESOLUTION_NAMES.map((name) => (
            <option key={name} value={name}>
              {RESOLUTIONS[name].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="View">
        <select
          className={SELECT_CLASS}
          value={settings.view}
          onChange={(event) => {
            const view = asView(event.target.value);
            if (view !== undefined) onChange({ ...settings, view });
          }}
        >
          {VIEW_MODES.map((name) => (
            <option key={name} value={name}>
              {VIEW_LABELS[name]}
            </option>
          ))}
        </select>
      </Field>
    </div>

    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-gray-700">Tool</legend>
      <div className="flex gap-1">
        {TOOLS.map((tool) => (
          <label
            key={tool}
            className={cn(
              "grow cursor-pointer rounded border p-1.5 text-center text-sm",
              settings.tool === tool
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-800",
            )}
          >
            <input
              type="radio"
              name="tool"
              className="sr-only"
              checked={settings.tool === tool}
              onChange={() => {
                onChange({ ...settings, tool });
              }}
              value={tool}
            />
            {TOOL_LABELS[tool]}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-600">{TOOL_HINTS[settings.tool]}</p>
    </fieldset>

    <Field label={`Speed ×${settings.speed.toFixed(2)}`}>
      <input
        type="range"
        min={0.05}
        max={1}
        step={0.05}
        value={settings.speed}
        onChange={(event) => {
          onChange({ ...settings, speed: Number(event.target.value) });
        }}
      />
    </Field>

    <div className="flex gap-2">
      <button
        type="button"
        className="grow rounded border border-gray-300 p-1.5"
        onClick={() => {
          onPausedChange(!paused);
        }}
      >
        {paused ? "Resume" : "Pause"}
      </button>
      <button
        type="button"
        className="grow rounded border border-gray-300 p-1.5 disabled:opacity-50"
        disabled={locked}
        onClick={onReset}
      >
        Reset
      </button>
    </div>

    <dl
      aria-label="Simulation statistics"
      className="grid grid-cols-2 gap-1 text-sm text-gray-700"
    >
      <dt>Broken</dt>
      <dd className="text-right">{(stats.erodedFraction * 100).toFixed(1)}%</dd>
      <dt>Pieces</dt>
      <dd className="text-right">{stats.chunks}</dd>
      <dt>Max plastic strain</dt>
      <dd className="text-right">{stats.maxPlasticStrain.toFixed(3)}</dd>
    </dl>
  </aside>
);
