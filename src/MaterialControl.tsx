import { formatNumber, MaterialSlider } from "@/MaterialSlider";
import { ResetButton } from "@/ResetButton";
import {
  arealDensity,
  crackEnergy,
  DEFAULT_MATERIAL,
  findMaterialPreset,
  FRACTURE_ENERGY_LOG_RANGE,
  matchPreset,
  MATERIAL_PRESETS,
  MATERIAL_RANGES,
  materialFromPreset,
  type MaterialSettings,
  MIN_FRAGMENT_AREA_LOG_RANGE,
  SURFACE_RANGES,
} from "@/sim/material";

interface Props {
  value: MaterialSettings;
  disabled: boolean;
  onChange: (value: MaterialSettings) => void;
}

export const MaterialControl = ({ value, disabled, onChange }: Props) => {
  const custom = (patch: Partial<MaterialSettings>): void => {
    onChange(matchPreset({ ...value, ...patch }));
  };
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-gray-700">
        Object material
      </legend>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <span className="flex items-center justify-between gap-2">
          Object material preset
          <ResetButton
            label="Object material preset"
            atDefault={value.preset === DEFAULT_MATERIAL.preset}
            onReset={() => {
              onChange(materialFromPreset(MATERIAL_PRESETS[0], value));
            }}
          />
        </span>
        <select
          aria-label="Object material preset"
          className="rounded border border-gray-300 bg-white p-1.5 font-normal"
          value={value.preset}
          onChange={(event) => {
            const selected = findMaterialPreset(event.target.value);
            if (selected !== undefined)
              onChange(materialFromPreset(selected, value));
            else if (event.target.value === "custom")
              onChange({ ...value, preset: "custom" });
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
      <MaterialSlider
        label="Object density (kg/m³)"
        unit=" kg/m³"
        value={value.density}
        range={MATERIAL_RANGES.density}
        atDefault={value.density === DEFAULT_MATERIAL.density}
        onReset={() => {
          custom({ density: DEFAULT_MATERIAL.density });
        }}
        onChange={(density) => {
          custom({ density });
        }}
      />
      <MaterialSlider
        label="Object friction coefficient"
        value={value.friction}
        range={SURFACE_RANGES.friction}
        atDefault={value.friction === DEFAULT_MATERIAL.friction}
        onReset={() => {
          custom({ friction: DEFAULT_MATERIAL.friction });
        }}
        onChange={(friction) => {
          custom({ friction });
        }}
      />
      <MaterialSlider
        label="Object restitution coefficient"
        value={value.restitution}
        range={SURFACE_RANGES.restitution}
        atDefault={value.restitution === DEFAULT_MATERIAL.restitution}
        onReset={() => {
          custom({ restitution: DEFAULT_MATERIAL.restitution });
        }}
        onChange={(restitution) => {
          custom({ restitution });
        }}
      />
      <MaterialSlider
        label="Fracture energy (J/m²)"
        unit=" J/m²"
        value={value.fractureEnergy}
        position={Math.log10(value.fractureEnergy)}
        range={FRACTURE_ENERGY_LOG_RANGE}
        atDefault={value.fractureEnergy === DEFAULT_MATERIAL.fractureEnergy}
        onReset={() => {
          custom({ fractureEnergy: DEFAULT_MATERIAL.fractureEnergy });
        }}
        onChange={(position) => {
          custom({ fractureEnergy: 10 ** position });
        }}
      />
      <MaterialSlider
        label="Thickness (mm)"
        unit=" mm"
        value={value.thicknessMm}
        range={MATERIAL_RANGES.thicknessMm}
        atDefault={value.thicknessMm === DEFAULT_MATERIAL.thicknessMm}
        onReset={() => {
          onChange({ ...value, thicknessMm: DEFAULT_MATERIAL.thicknessMm });
        }}
        onChange={(thicknessMm) => {
          onChange({ ...value, thicknessMm });
        }}
      />
      <MaterialSlider
        label="Min fragment area (m²)"
        unit=" m²"
        value={value.minFragmentArea}
        position={Math.log10(value.minFragmentArea)}
        range={MIN_FRAGMENT_AREA_LOG_RANGE}
        atDefault={value.minFragmentArea === DEFAULT_MATERIAL.minFragmentArea}
        onReset={() => {
          onChange({
            ...value,
            minFragmentArea: DEFAULT_MATERIAL.minFragmentArea,
          });
        }}
        onChange={(position) => {
          onChange({ ...value, minFragmentArea: 10 ** position });
        }}
      />
      <p
        className="text-sm text-gray-700"
        role="status"
        aria-label="Areal density"
      >
        Areal density: {formatNumber(arealDensity(value))} kg/m²
      </p>
      <p
        className="text-sm text-gray-700"
        role="status"
        aria-label="Crack energy"
      >
        Crack energy: {formatNumber(crackEnergy(value))} J/m
      </p>
      <p className="text-xs text-gray-600">
        Areal density is density × thickness; crack energy is fracture energy ×
        thickness. Min fragment area is the reference at world scale ×1; smaller
        worlds apply it times the square of the scale. Presets are
        representative values and keep the thickness and the minimum fragment
        area. Friction, restitution and fracture energy apply immediately;
        density and thickness restart the scene.
      </p>
    </fieldset>
  );
};
