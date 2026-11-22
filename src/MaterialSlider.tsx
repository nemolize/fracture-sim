import { ResetButton } from "@/ResetButton";

export const formatNumber = (value: number): string =>
  value.toLocaleString("en-US", { maximumSignificantDigits: 5 });

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
      aria-valuetext={`${formatNumber(value)}${unit}`}
      onChange={(event) => {
        onChange(Number(event.target.value));
      }}
    />
  </div>
);
