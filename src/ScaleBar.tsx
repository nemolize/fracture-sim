import { type EnvironmentSettings, worldScale } from "@/rigid/environment";

export const ScaleBar = ({
  environment,
}: {
  environment: EnvironmentSettings;
}) => {
  const targetMetres = environment.width / 5;
  const power = 10 ** Math.floor(Math.log10(targetMetres));
  const fraction = targetMetres / power;
  const metres = (fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1) * power;

  return (
    <div
      role="group"
      aria-label="World scale reference"
      className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-end gap-1 text-xs text-gray-800"
    >
      <span className="mr-3 rounded bg-white/90 px-2 py-1">
        {metres} m · ×{worldScale(environment).toFixed(1)}
      </span>
      <div
        role="img"
        aria-label={`${String(metres)} m scale bar`}
        className="mr-3 h-2 border-x-2 border-t-2 border-gray-700 bg-white/60"
        style={{ width: `${String((metres / environment.width) * 100)}%` }}
      />
    </div>
  );
};
