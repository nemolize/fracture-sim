import type { ReactNode } from "react";

import { EnvironmentControl } from "@/EnvironmentControl";
import { MaterialControl } from "@/MaterialControl";
import { ObjectControl } from "@/ObjectControl";
import { ResetButton } from "@/ResetButton";
import { naturalObjectSize } from "@/rigid/object-shape";
import { fitObjectSize } from "@/rigid/object-size";
import { TOOL_HINTS, TOOL_LABELS, TOOLS } from "@/rigid/tools";
import { SCENES } from "@/rigid/types";
import {
  asScene,
  DEFAULT_SETTINGS,
  MOTION_RANGES,
  resetParameters,
  type Settings,
} from "@/settings";
import type { MotionControl } from "@/useMotion";

interface Props {
  settings: Settings;
  paused: boolean;
  locked: boolean;
  motion: Pick<MotionControl, "support" | "enabled" | "notice" | "setEnabled">;
  onChange: (next: Settings) => void;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
    {label}
    {children}
  </label>
);

const MOTION_NOTICES: Record<MotionControl["support"], string | null> = {
  checking: "Checking for a motion sensor…",
  unsupported: "This device or browser has no motion sensor.",
  supported: null,
};

const MOTION_HINT =
  "Tilt the device to tilt gravity, and shake it to push the body.";

const MotionSlider = ({
  label,
  format,
  range,
  value,
  defaultValue,
  disabled,
  onChange,
}: {
  label: string;
  format: (value: number) => string;
  range: { min: number; max: number; step: number };
  value: number;
  defaultValue: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) => (
  <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
    <span className="flex items-center justify-between gap-2">
      {label}
      <span className="flex items-center gap-1">
        {format(value)}
        <ResetButton
          label={label}
          atDefault={value === defaultValue}
          disabled={disabled}
          onReset={() => {
            onChange(defaultValue);
          }}
        />
      </span>
    </span>
    <input
      type="range"
      aria-label={label}
      {...range}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        onChange(Number(event.target.value));
      }}
    />
  </div>
);

const SELECT_CLASS =
  "rounded border border-gray-300 bg-white p-1.5 font-normal";

export const ControlPanel = ({
  settings,
  paused,
  locked,
  motion,
  onChange,
}: Props) => (
  <aside className="flex w-full flex-col gap-4 rounded-lg bg-white/95 p-4 shadow-lg">
    <button
      type="button"
      disabled={locked}
      className="rounded border border-gray-300 p-1.5 text-sm disabled:opacity-50"
      onClick={() => {
        onChange(resetParameters(settings));
      }}
    >
      Reset parameters
    </button>

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
          {SCENES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
    </div>

    <fieldset className="flex flex-col gap-2" disabled={locked || paused}>
      <legend className="text-sm font-medium text-gray-700">Tool</legend>
      <div className="flex gap-2">
        {TOOLS.map((tool) => (
          <label key={tool} className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="tool"
              checked={settings.tool === tool}
              onChange={() => {
                onChange({ ...settings, tool });
              }}
            />
            {TOOL_LABELS[tool]}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-600">{TOOL_HINTS[settings.tool]}</p>
    </fieldset>

    <EnvironmentControl
      value={settings.environment}
      disabled={locked}
      onChange={(environment) => {
        onChange({
          ...settings,
          environment,
          objectSize: fitObjectSize(settings.objectSize, environment),
        });
      }}
    />

    <ObjectControl
      shape={settings.objectShape}
      onShapeChange={(objectShape) => {
        onChange({
          ...settings,
          objectShape,
          objectSize: naturalObjectSize(
            objectShape,
            settings.objectSize.width,
            settings.environment,
          ),
        });
      }}
      value={settings.objectSize}
      bounds={settings.environment}
      disabled={locked || settings.scene !== "plate"}
      onChange={(objectSize) => {
        onChange({ ...settings, objectSize });
      }}
    />

    <MaterialControl
      value={settings.material}
      disabled={locked}
      onChange={(material) => {
        onChange({ ...settings, material });
      }}
    />

    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-gray-700">Motion</legend>
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={motion.enabled}
          disabled={motion.support !== "supported"}
          onChange={(event) => {
            motion.setEnabled(event.target.checked);
          }}
        />
        Device tilt
      </label>
      <p className="text-xs text-gray-600">
        {MOTION_NOTICES[motion.support] ?? motion.notice ?? MOTION_HINT}
      </p>
      <MotionSlider
        label="Shake strength"
        format={(value) => `×${value.toFixed(1)}`}
        range={MOTION_RANGES.inertiaScale}
        value={settings.inertiaScale}
        defaultValue={DEFAULT_SETTINGS.inertiaScale}
        disabled={!motion.enabled}
        onChange={(inertiaScale) => {
          onChange({ ...settings, inertiaScale });
        }}
      />
      <MotionSlider
        label="Shake limit"
        format={(value) => `${value.toFixed(0)} m/s²`}
        range={MOTION_RANGES.inertiaCap}
        value={settings.inertiaCap}
        defaultValue={DEFAULT_SETTINGS.inertiaCap}
        disabled={!motion.enabled}
        onChange={(inertiaCap) => {
          onChange({ ...settings, inertiaCap });
        }}
      />
      <MotionSlider
        label="Tilt smoothing"
        format={(value) => `${value.toFixed(2)} s`}
        range={MOTION_RANGES.tiltSmoothing}
        value={settings.tiltSmoothing}
        defaultValue={DEFAULT_SETTINGS.tiltSmoothing}
        disabled={!motion.enabled}
        onChange={(tiltSmoothing) => {
          onChange({ ...settings, tiltSmoothing });
        }}
      />
    </fieldset>
  </aside>
);
