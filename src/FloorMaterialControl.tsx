import { MaterialSlider } from "@/MaterialSlider";
import { ResetButton } from "@/ResetButton";
import {
  DEFAULT_FLOOR_MATERIAL,
  findFloorPreset,
  FLOOR_PRESETS,
  floorFromPreset,
  type FloorMaterialSettings,
  matchFloorPreset,
} from "@/sim/floor-material";
import { SURFACE_RANGES } from "@/sim/material";

interface Props {
  value: FloorMaterialSettings;
  disabled: boolean;
  onChange: (value: FloorMaterialSettings) => void;
}

export const FloorMaterialControl = ({ value, disabled, onChange }: Props) => (
  <fieldset className="flex flex-col gap-2" disabled={disabled}>
    <legend className="text-sm font-medium text-gray-700">
      Floor material
    </legend>
    <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <span className="flex items-center justify-between gap-2">
        Floor material preset
        <ResetButton
          label="Floor material preset"
          atDefault={
            value.preset !== "custom" &&
            value.friction === DEFAULT_FLOOR_MATERIAL.friction &&
            value.restitution === DEFAULT_FLOOR_MATERIAL.restitution
          }
          onReset={() => {
            onChange(DEFAULT_FLOOR_MATERIAL);
          }}
        />
      </span>
      <select
        aria-label="Floor material preset"
        className="rounded border border-gray-300 bg-white p-1.5 font-normal"
        value={value.preset}
        onChange={(event) => {
          const selected = findFloorPreset(event.target.value);
          if (selected !== undefined) onChange(floorFromPreset(selected));
          else if (event.target.value === "custom")
            onChange({ ...value, preset: "custom" });
        }}
      >
        {FLOOR_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>
    </div>
    <MaterialSlider
      label="Floor friction coefficient"
      value={value.friction}
      range={SURFACE_RANGES.friction}
      atDefault={value.friction === DEFAULT_FLOOR_MATERIAL.friction}
      onReset={() => {
        onChange(
          matchFloorPreset({
            ...value,
            friction: DEFAULT_FLOOR_MATERIAL.friction,
          }),
        );
      }}
      onChange={(friction) => {
        onChange(matchFloorPreset({ ...value, friction }));
      }}
    />
    <MaterialSlider
      label="Floor restitution coefficient"
      value={value.restitution}
      range={SURFACE_RANGES.restitution}
      atDefault={value.restitution === DEFAULT_FLOOR_MATERIAL.restitution}
      onReset={() => {
        onChange(
          matchFloorPreset({
            ...value,
            restitution: DEFAULT_FLOOR_MATERIAL.restitution,
          }),
        );
      }}
      onChange={(restitution) => {
        onChange(matchFloorPreset({ ...value, restitution }));
      }}
    />
    <p className="text-xs text-gray-600">
      Applies immediately. Contact friction and restitution are the average of
      the floor and the object. The walls and ceiling keep their own values.
    </p>
  </fieldset>
);
