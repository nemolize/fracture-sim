import {
  ENVIRONMENT_KEYS,
  ENVIRONMENT_RANGES,
  type EnvironmentSettings,
} from "@/rigid/environment";

const LABELS: Record<keyof EnvironmentSettings, string> = {
  gravity: "Gravity (m/s²)",
  width: "World width (m)",
  height: "World height (m)",
  density: "Areal density (kg/m²)",
  friction: "Friction coefficient",
};

export const EnvironmentControl = ({
  value,
  disabled,
  onChange,
}: {
  value: EnvironmentSettings;
  disabled: boolean;
  onChange: (value: EnvironmentSettings) => void;
}) => (
  <fieldset className="flex flex-col gap-2" disabled={disabled}>
    <legend className="text-sm font-medium text-gray-700">World</legend>
    {ENVIRONMENT_KEYS.map((key) => (
      <label
        key={key}
        className="flex flex-col gap-1 text-sm font-medium text-gray-700"
      >
        <span className="flex justify-between gap-2">
          <span>{LABELS[key]}</span>
          <span>{value[key].toLocaleString("en-US")}</span>
        </span>
        <input
          type="range"
          aria-label={LABELS[key]}
          {...ENVIRONMENT_RANGES[key]}
          value={value[key]}
          onChange={(event) => {
            onChange({ ...value, [key]: Number(event.target.value) });
          }}
        />
      </label>
    ))}
    <p className="text-xs text-gray-600">
      Gravity and friction apply immediately. Size and density changes restart
      the scene. Sensor gravity scales by g / 9.8; shake stays independent.
    </p>
  </fieldset>
);
