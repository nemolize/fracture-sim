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
      className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-start gap-1 text-xs text-gray-800"
    >
      <span className="ml-3 rounded bg-white/60 px-2 py-1 backdrop-blur-md">
        {label}
      </span>
      <div
        role="img"
        aria-label={`${label} scale bar`}
        className="ml-3 h-2 border-x-2 border-b-2 border-black"
        style={{
          width: "10%",
          filter:
            "drop-shadow(1px 0 0 white) drop-shadow(-1px 0 0 white) drop-shadow(0 1px 0 white) drop-shadow(0 -1px 0 white)",
        }}
      />
    </div>
  );
};
