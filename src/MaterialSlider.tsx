import { formatNumber } from "@/format";
import { ResetButton } from "@/ResetButton";

export const MaterialSlider = ({
  label,
  unit = "",
  value,
  position = value,
  range,
  atDefault,
  onReset,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  position?: number;
  range: { min: number; max: number; step: number };
  atDefault: boolean;
  onReset: () => void;
  onChange: (position: number) => void;
}) => (
  <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
    <span className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        {formatNumber(value)}
        <ResetButton label={label} atDefault={atDefault} onReset={onReset} />
      </span>
    </span>
    <input
      aria-label={label}
      type="range"
      {...range}
      value={position}
      {...(position === value
        ? {}
        : {
            "aria-valuemin": 10 ** range.min,
            "aria-valuemax": 10 ** range.max,
            "aria-valuenow": value,
          })}
      aria-valuetext={`${formatNumber(value)}${unit}`}
      onChange={(event) => {
        onChange(Number(event.target.value));
      }}
    />
  </div>
);
