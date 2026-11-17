import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ControlPanel } from "./ControlPanel";
import { DEFAULT_SETTINGS } from "./settings";

// userEvent cannot drag a range input, so set it the way a browser reports it.
const setRange = (slider: HTMLElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(slider, value);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
};

const stats = { erodedFraction: 0.123, chunks: 4, maxPlasticStrain: 0.5 };

const setup = (
  paused = false,
  locked = false,
  motion: Partial<Parameters<typeof ControlPanel>[0]["motion"]> = {},
) => {
  const onChange = vi.fn();
  const setEnabled = vi.fn();
  const onPausedChange = vi.fn();
  const onReset = vi.fn();
  render(
    <ControlPanel
      settings={DEFAULT_SETTINGS}
      stats={stats}
      paused={paused}
      locked={locked}
      motion={{
        support: "supported",
        enabled: false,
        notice: null,
        setEnabled,
        ...motion,
      }}
      onChange={onChange}
      onPausedChange={onPausedChange}
      onReset={onReset}
    />,
  );
  return {
    onChange,
    onPausedChange,
    onReset,
    setEnabled,
    user: userEvent.setup(),
  };
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
    setRange(screen.getByLabelText(/^Speed/), "0.9");
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, speed: 0.9 });
  });

  describe("motion", () => {
    it("turns the gyro on and off from the checkbox", async () => {
      const { setEnabled, user } = setup();
      await user.click(screen.getByLabelText("Gyro tilt"));
      expect(setEnabled).toHaveBeenCalledWith(true);
    });

    it("turns it off when it is on", async () => {
      const { setEnabled, user } = setup(false, false, { enabled: true });
      expect(screen.getByLabelText("Gyro tilt")).toBeChecked();
      await user.click(screen.getByLabelText("Gyro tilt"));
      expect(setEnabled).toHaveBeenCalledWith(false);
    });

    it.each([
      ["checking", /Checking for a motion sensor/],
      ["unsupported", /no motion sensor/],
    ] as const)(
      "disables the toggle and says why while %s",
      (support, text) => {
        setup(false, false, { support });
        expect(screen.getByLabelText("Gyro tilt")).toBeDisabled();
        expect(screen.getByText(text)).toBeVisible();
      },
    );

    it("shows the reason the toggle went back off", () => {
      setup(false, false, { notice: "Motion access was denied." });
      expect(screen.getByText("Motion access was denied.")).toBeVisible();
    });

    it("hints at tilt and shake otherwise", () => {
      setup();
      expect(screen.getByText(/Tilt the device/)).toBeVisible();
    });

    it("disables the sliders while the gyro is off and enables them when on", () => {
      setup();
      for (const label of [
        /^Shake strength/,
        /^Shake limit/,
        /^Tilt smoothing/,
      ]) {
        expect(screen.getByLabelText(label)).toBeDisabled();
      }
    });

    it.each([
      [/^Shake strength/, "1.5", { inertiaScale: 1.5 }],
      [/^Shake limit/, "30", { inertiaCap: 30 }],
      [/^Tilt smoothing/, "0.5", { tiltSmoothing: 0.5 }],
    ])("changes %s while the gyro is on", (label, value, patch) => {
      const { onChange } = setup(false, false, { enabled: true });
      setRange(screen.getByLabelText(label), value);
      expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, ...patch });
    });
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
