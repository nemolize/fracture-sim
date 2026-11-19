import { useState } from "react";

import { isFractureToughness, MIN_FRACTURE_TOUGHNESS } from "@/sim/material";

interface Props {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

export const MaterialControl = ({ value, disabled, onChange }: Props) => {
  const [draft, setDraft] = useState(String(value));
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-gray-700">Material</legend>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Fracture toughness (J/m)
        <input
          type="number"
          min={MIN_FRACTURE_TOUGHNESS}
          step="any"
          className="rounded border border-gray-300 bg-white p-1.5 font-normal"
          value={draft}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const number = Number(text);
            if (isFractureToughness(number)) onChange(number);
          }}
          onBlur={() => {
            setDraft(String(value));
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
