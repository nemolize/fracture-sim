import type { EnvironmentSettings } from "@/rigid/environment";
import {
  asObjectShape,
  OBJECT_SHAPES,
  type ObjectShape,
} from "@/rigid/object-shape";
import {
  maxObjectSize,
  MIN_OBJECT_SIZE,
  OBJECT_AXES,
  type ObjectSize,
} from "@/rigid/object-size";

const SHAPE_LABELS: Record<ObjectShape, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  hexagon: "Hexagon",
};

const LABELS = { width: "Object width (m)", height: "Object height (m)" };

export const ObjectControl = ({
  value,
  shape,
  onShapeChange,
  bounds,
  disabled,
  onChange,
}: {
  value: ObjectSize;
  shape: ObjectShape;
  onShapeChange: (shape: ObjectShape) => void;
  bounds: Pick<EnvironmentSettings, "width" | "height">;
  disabled: boolean;
  onChange: (value: ObjectSize) => void;
}) => (
  <fieldset className="flex flex-col gap-2" disabled={disabled}>
    <legend className="text-sm font-medium text-gray-700">Object</legend>
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      Object shape
      <select
        className="rounded border border-gray-300 bg-white p-1.5 font-normal"
        value={shape}
        onChange={(event) => {
          const next = asObjectShape(event.target.value);
          if (next !== undefined) onShapeChange(next);
        }}
      >
        {OBJECT_SHAPES.map((item) => (
          <option key={item} value={item}>
            {SHAPE_LABELS[item]}
          </option>
        ))}
      </select>
    </label>
    {OBJECT_AXES.map((axis) => (
      <label
        key={axis}
        className="flex flex-col gap-1 text-sm font-medium text-gray-700"
      >
        <span className="flex justify-between gap-2">
          <span>{LABELS[axis]}</span>
          <span>
            {value[axis].toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </span>
        <input
          type="range"
          aria-label={LABELS[axis]}
          min={MIN_OBJECT_SIZE}
          max={maxObjectSize(bounds)[axis]}
          step="any"
          value={value[axis]}
          onChange={(event) => {
            onChange({ ...value, [axis]: Number(event.target.value) });
          }}
        />
      </label>
    ))}
    <p className="text-xs text-gray-600">
      Selecting Ellipse makes a circle; Triangle and Hexagon have equal sides.
      Adjust width and height to stretch the shape. Changes restart the scene.
    </p>
  </fieldset>
);
