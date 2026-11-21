import type { EnvironmentSettings } from "@/rigid/environment";

export const ScaleBar = ({
  environment,
}: {
  environment: EnvironmentSettings;
}) => {
  const label = `${(environment.width / 10).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} m`;

  return (
    <div
      role="group"
      aria-label="World scale reference"
      className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-end gap-1 text-xs text-gray-800"
    >
      <span className="mr-3 rounded bg-white/90 px-2 py-1">{label}</span>
      <div
        role="img"
        aria-label={`${label} scale bar`}
        className="mr-3 h-2 border-x-2 border-b-2 border-gray-700 bg-white/60"
        style={{ width: "10%" }}
      />
    </div>
  );
};
