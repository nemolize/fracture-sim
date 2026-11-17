import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ControlPanel } from "./ControlPanel";
import { DEFAULT_SETTINGS } from "./settings";

const stats = { erodedFraction: 0.123, chunks: 4, maxPlasticStrain: 0.5 };

const setup = (paused = false, locked = false) => {
  const onChange = vi.fn();
  const onPausedChange = vi.fn();
  const onReset = vi.fn();
  render(
    <ControlPanel
      settings={DEFAULT_SETTINGS}
      stats={stats}
      paused={paused}
      locked={locked}
      onChange={onChange}
      onPausedChange={onPausedChange}
      onReset={onReset}
    />,
  );
  return { onChange, onPausedChange, onReset, user: userEvent.setup() };
};

describe("ControlPanel", () => {
  it("shows the statistics", () => {
    setup();
    const list = screen.getByLabelText("Simulation statistics");
    expect(list).toHaveTextContent("12.3%");
    expect(list).toHaveTextContent("4");
    expect(list).toHaveTextContent("0.500");
  });

  it.each([
    ["Scene", "tower", { scene: "tower" }],
    ["Material", "glass", { material: "glass" }],
    ["Mesh resolution", "finest", { resolution: "finest" }],
    ["View", "damage", { view: "damage" }],
  ])("changes %s from the select", async (label, value, patch) => {
    const { onChange, user } = setup();
    await user.selectOptions(screen.getByLabelText(label), value);
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, ...patch });
  });

  it.each(["Scene", "Material", "Mesh resolution", "View"])(
    "ignores an unknown value in %s",
    (label) => {
      const { onChange } = setup();
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: "unknown" },
      });
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("changes the tool and describes the selected one", async () => {
    const { onChange, user } = setup();
    expect(screen.getByText(/ball flies the way you drag/)).toBeVisible();
    await user.click(screen.getByLabelText("Pull"));
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      tool: "pull",
    });
  });

  it("changes the speed", () => {
    const { onChange } = setup();
    const slider = screen.getByRole("slider");
    // userEvent cannot drag a range input, so set it the way a browser reports it.
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(slider, "0.9");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, speed: 0.9 });
  });

  it("toggles pause and resets", async () => {
    const { onPausedChange, onReset, user } = setup();
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPausedChange).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("offers to resume while paused", () => {
    setup(true);
    expect(screen.getByRole("button", { name: "Resume" })).toBeVisible();
  });

  it("lists at least three mesh resolutions", () => {
    setup();
    expect(
      within(screen.getByLabelText("Mesh resolution")).getAllByRole("option")
        .length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("locks Reset and the settings that rebuild the solver, not Pause", () => {
    setup(false, true);
    for (const label of ["Scene", "Material", "Mesh resolution"]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
  });
});
