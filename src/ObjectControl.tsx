import type { EnvironmentSettings } from "@/rigid/environment";
import {
  maxObjectSize,
  MIN_OBJECT_SIZE,
  OBJECT_AXES,
  type ObjectSize,
} from "@/rigid/object-size";

const LABELS = { width: "Object width (m)", height: "Object height (m)" };

export const ObjectControl = ({
  value,
  bounds,
  disabled,
  onChange,
}: {
  value: ObjectSize;
  bounds: Pick<EnvironmentSettings, "width" | "height">;
  disabled: boolean;
  onChange: (value: ObjectSize) => void;
}) => (
  <fieldset className="flex flex-col gap-2" disabled={disabled}>
    <legend className="text-sm font-medium text-gray-700">Object</legend>
    {OBJECT_AXES.map((axis) => (
      <label
        key={axis}
        className="flex flex-col gap-1 text-sm font-medium text-gray-700"
      >
        <span className="flex justify-between gap-2">
          <span>{LABELS[axis]}</span>
          <span>{value[axis].toLocaleString("en-US")}</span>
        </span>
        <input
          type="range"
          aria-label={LABELS[axis]}
          min={MIN_OBJECT_SIZE}
          max={maxObjectSize(bounds)[axis]}
          step={0.1}
          value={value[axis]}
          onChange={(event) => {
            onChange({ ...value, [axis]: Number(event.target.value) });
          }}
        />
      </label>
    ))}
    <p className="text-xs text-gray-600">
      Initial plate bounding box. Changes restart the scene. Dimensions are
      limited to the world size.
    </p>
  </fieldset>
);
