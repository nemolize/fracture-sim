import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENT_RANGES,
  type EnvironmentSettings,
  withWorldScale,
  WORLD_SCALE_RANGE,
  worldScale,
} from "@/rigid/environment";

const CONTROLS = ["gravity", "scale", "density", "friction"] as const;
const LABELS = {
  gravity: "Gravity (m/s²)",
  scale: "World scale",
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
    {CONTROLS.map((key) => (
      <label
        key={key}
        className="flex flex-col gap-1 text-sm font-medium text-gray-700"
      >
        <span className="flex justify-between gap-2">
          <span>{LABELS[key]}</span>
          <span>
            {key === "scale"
              ? `×${worldScale(value).toFixed(1)}`
              : value[key].toLocaleString("en-US")}
          </span>
        </span>
        <input
          type="range"
          aria-label={LABELS[key]}
          {...(key === "scale" ? WORLD_SCALE_RANGE : ENVIRONMENT_RANGES[key])}
          value={key === "scale" ? worldScale(value) : value[key]}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(
              key === "scale"
                ? withWorldScale(value, next)
                : { ...value, [key]: next },
            );
          }}
        />
      </label>
    ))}
    <p className="text-xs text-gray-600">
      World scale ×1 is {DEFAULT_ENVIRONMENT.width} ×{" "}
      {DEFAULT_ENVIRONMENT.height} m; width and height scale together. Scale and
      density changes restart the scene. Gravity and friction apply immediately.
      Sensor gravity scales by g / 9.8; shake stays independent.
    </p>
  </fieldset>
);
