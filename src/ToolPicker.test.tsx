import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { TOOL_HINTS } from "@/rigid/tools";

import { ToolPicker } from "./ToolPicker";

const setup = (disabled = false) => {
  const onChange = vi.fn();
  render(<ToolPicker value="grab" disabled={disabled} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
};

it("offers every tool and marks the current one", () => {
  setup();
  expect(screen.getByRole("radio", { name: "Grab" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Throw ball" })).not.toBeChecked();
  expect(screen.getByRole("radio", { name: "Blast" })).not.toBeChecked();
  expect(screen.getByText(TOOL_HINTS.grab)).toBeVisible();
});

it("reports the chosen tool", async () => {
  const { onChange, user } = setup();
  await user.click(screen.getByLabelText("Throw ball"));
  expect(onChange).toHaveBeenCalledWith("throw");
});

it("disables every tool when disabled", () => {
  setup(true);
  expect(screen.getByRole("radio", { name: "Blast" })).toBeDisabled();
});
