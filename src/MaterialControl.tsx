import {
  crackEnergy,
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
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Fracture preset
        <select
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
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <span className="flex justify-between gap-2">
          <span>Fracture energy (J/m²)</span>
          <span>{format(energy)}</span>
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
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <span className="flex justify-between gap-2">
          <span>Thickness (mm)</span>
          <span>{format(value.thicknessMm)}</span>
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
      </label>
      <p
        className="text-sm text-gray-700"
        role="status"
        aria-label="Crack energy"
      >
        Crack energy: {format(crackEnergy(value))} J/m
      </p>
      <p className="text-xs text-gray-600">
        Fracture energy × thickness. Presets are representative measured values.
        Changes apply to future impacts; Reset restores bodies with this
        material.
      </p>
    </fieldset>
  );
};
