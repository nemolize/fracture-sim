import { type Tool, TOOL_HINTS, TOOL_LABELS, TOOLS } from "@/rigid/tools";

interface Props {
  value: Tool;
  disabled: boolean;
  onChange: (tool: Tool) => void;
}

export const ToolPicker = ({ value, disabled, onChange }: Props) => (
  <fieldset
    disabled={disabled}
    className="pointer-events-none flex flex-col items-start gap-1 text-sm text-gray-800 disabled:opacity-50"
  >
    <legend className="sr-only">Tool</legend>
    <div className="pointer-events-auto flex gap-1 rounded bg-white/60 p-1 backdrop-blur-md">
      {TOOLS.map((tool) => (
        <label
          key={tool}
          title={TOOL_HINTS[tool]}
          className="relative cursor-pointer rounded px-2 py-1 has-checked:bg-gray-800 has-checked:text-white has-focus-visible:outline-2"
        >
          <input
            type="radio"
            name="tool"
            className="absolute inset-0 cursor-pointer opacity-0"
            checked={value === tool}
            onChange={() => {
              onChange(tool);
            }}
          />
          {TOOL_LABELS[tool]}
        </label>
      ))}
    </div>
  </fieldset>
);
