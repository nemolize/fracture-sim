import { ResetButton } from "@/ResetButton";
import {
  crackEnergy,
  DEFAULT_MATERIAL,
  findMaterialPreset,
  MATERIAL_PRESETS,
  materialFractureEnergy,
  type MaterialSettings,
} from "@/sim/material";

interface Props {
  value: MaterialSettings;
  disabled: boolean;
  onChange: (value: MaterialSettings) => void;
}

const format = (value: number): string =>
  value.toLocaleString("en-US", { maximumSignificantDigits: 5 });

export const MaterialControl = ({ value, disabled, onChange }: Props) => {
  const energy = materialFractureEnergy(value);
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-gray-700">Material</legend>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <span className="flex items-center justify-between gap-2">
          Fracture preset
          <ResetButton
            label="Fracture preset"
            atDefault={value.preset === DEFAULT_MATERIAL.preset}
            onReset={() => {
              onChange({ ...value, preset: DEFAULT_MATERIAL.preset });
            }}
          />
        </span>
        <select
          aria-label="Fracture preset"
          className="rounded border border-gray-300 bg-white p-1.5 font-normal"
          value={value.preset}
          onChange={(event) => {
            const preset = event.target.value;
            const selected = findMaterialPreset(preset);
            if (preset === "custom" || selected !== undefined) {
              onChange({ ...value, preset: selected?.id ?? "custom" });
            }
          }}
        >
          {MATERIAL_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <span className="flex justify-between gap-2">
          <span>Fracture energy (J/m²)</span>
          <span className="flex items-center gap-1">
            {format(energy)}
            <ResetButton
              label="Fracture energy (J/m²)"
              atDefault={energy === materialFractureEnergy(DEFAULT_MATERIAL)}
              onReset={() => {
                onChange({
                  ...value,
                  preset: DEFAULT_MATERIAL.preset,
                  customFractureEnergy: DEFAULT_MATERIAL.customFractureEnergy,
                });
              }}
            />
          </span>
        </span>
        <input
          aria-label="Fracture energy (J/m²)"
          type="range"
          min={-1}
          max={6}
          step={0.01}
          value={Math.log10(energy)}
          aria-valuemin={0.1}
          aria-valuemax={1_000_000}
          aria-valuenow={energy}
          aria-valuetext={`${format(energy)} J/m²`}
          onChange={(event) => {
            onChange({
              ...value,
              preset: "custom",
              customFractureEnergy: 10 ** Number(event.target.value),
            });
          }}
        />
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <span className="flex justify-between gap-2">
          <span>Thickness (mm)</span>
          <span className="flex items-center gap-1">
            {format(value.thicknessMm)}
            <ResetButton
              label="Thickness (mm)"
              atDefault={value.thicknessMm === DEFAULT_MATERIAL.thicknessMm}
              onReset={() => {
                onChange({
                  ...value,
                  thicknessMm: DEFAULT_MATERIAL.thicknessMm,
                });
              }}
            />
          </span>
        </span>
        <input
          aria-label="Thickness (mm)"
          type="range"
          min={0.1}
          max={100}
          step={0.1}
          value={value.thicknessMm}
          aria-valuetext={`${format(value.thicknessMm)} mm`}
          onChange={(event) => {
            onChange({ ...value, thicknessMm: Number(event.target.value) });
          }}
        />
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <span className="flex justify-between gap-2">
          <span>Min fragment area (m²)</span>
          <span className="flex items-center gap-1">
            {format(value.minFragmentArea)}
            <ResetButton
              label="Min fragment area (m²)"
              atDefault={
                value.minFragmentArea === DEFAULT_MATERIAL.minFragmentArea
              }
              onReset={() => {
                onChange({
                  ...value,
                  minFragmentArea: DEFAULT_MATERIAL.minFragmentArea,
                });
              }}
            />
          </span>
        </span>
        <input
          aria-label="Min fragment area (m²)"
          type="range"
          min={-5}
          max={-2}
          step={0.01}
          value={Math.log10(value.minFragmentArea)}
          aria-valuemin={0.00001}
          aria-valuemax={0.01}
          aria-valuenow={value.minFragmentArea}
          aria-valuetext={`${format(value.minFragmentArea)} m²`}
          onChange={(event) => {
            onChange({
              ...value,
              minFragmentArea: 10 ** Number(event.target.value),
            });
          }}
        />
      </div>
      <p
        className="text-sm text-gray-700"
        role="status"
        aria-label="Crack energy"
      >
        Crack energy: {format(crackEnergy(value))} J/m
      </p>
      <p className="text-xs text-gray-600">
        Fracture energy × thickness. Presets are representative measured values.
        Min fragment area is the reference at world scale ×1; smaller worlds
        apply it times the square of the scale. Changes apply to future impacts;
        Reset restores bodies with this material.
      </p>
    </fieldset>
  );
};
