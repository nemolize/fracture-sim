import { MIN_FRACTURE_TOUGHNESS } from "@/sim/material";

interface Props {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

const MAX_FRACTURE_TOUGHNESS = 10_000;

export const MaterialControl = ({ value, disabled, onChange }: Props) => {
  const display = value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-gray-700">Material</legend>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <span className="flex justify-between gap-2">
          <span>Fracture toughness (J/m)</span>
          <span>{display}</span>
        </span>
        <input
          aria-label="Fracture toughness (J/m)"
          aria-valuemin={MIN_FRACTURE_TOUGHNESS}
          aria-valuemax={MAX_FRACTURE_TOUGHNESS}
          aria-valuenow={value}
          aria-valuetext={`${display} J/m`}
          type="range"
          min={Math.log10(MIN_FRACTURE_TOUGHNESS)}
          max={Math.log10(MAX_FRACTURE_TOUGHNESS)}
          step={0.01}
          value={Math.log10(value)}
          onChange={(event) => {
            onChange(10 ** Number(event.target.value));
          }}
        />
      </label>
      <p className="text-xs text-gray-600">
        Higher values resist breaking. Applies to future impacts; Reset rebuilds
        the scene with this material.
      </p>
    </fieldset>
  );
};
