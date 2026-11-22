import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ControlPanel } from "./ControlPanel";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

// userEvent cannot drag a range input, so set it the way a browser reports it.
const setRange = (slider: HTMLElement, value: string): void => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(slider, value);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
};

const setup = (
  paused = false,
  locked = false,
  motion: Partial<Parameters<typeof ControlPanel>[0]["motion"]> = {},
  settings: Partial<Settings> = {},
) => {
  const onChange = vi.fn<(next: Settings) => void>();
  const setEnabled = vi.fn();
  render(
    <ControlPanel
      settings={{ ...DEFAULT_SETTINGS, ...settings }}
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
    />,
  );
  return {
    onChange,
    setEnabled,
    user: userEvent.setup(),
  };
};

describe("ControlPanel", () => {
  it.each([["Scene", "pile", { scene: "pile" }]])(
    "changes %s from the select",
    async (label, value, patch) => {
      const { onChange, user } = setup();
      await user.selectOptions(screen.getByLabelText(label), value);
      expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, ...patch });
    },
  );

  it.each(["Scene"])("ignores an unknown value in %s", (label) => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: "unknown" },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  describe("motion", () => {
    it("turns the device tilt on and off from the checkbox", async () => {
      const { setEnabled, user } = setup();
      await user.click(screen.getByLabelText("Device tilt"));
      expect(setEnabled).toHaveBeenCalledWith(true);
    });

    it("turns it off when it is on", async () => {
      const { setEnabled, user } = setup(false, false, { enabled: true });
      expect(screen.getByLabelText("Device tilt")).toBeChecked();
      await user.click(screen.getByLabelText("Device tilt"));
      expect(setEnabled).toHaveBeenCalledWith(false);
    });

    it.each([
      ["checking", /Checking for a motion sensor/],
      ["unsupported", /no motion sensor/],
    ] as const)(
      "disables the toggle and says why while %s",
      (support, text) => {
        setup(false, false, { support });
        expect(screen.getByLabelText("Device tilt")).toBeDisabled();
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

    it("disables the sliders while the device tilt is off and enables them when on", () => {
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
    ])("changes %s while the device tilt is on", (label, value, patch) => {
      const { onChange } = setup(false, false, { enabled: true });
      setRange(screen.getByLabelText(label), value);
      expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, ...patch });
    });
  });

  it("keeps Pause out of the popup", () => {
    setup();
    expect(
      screen.queryByRole("button", { name: /^(Pause|Resume)$/ }),
    ).toBeNull();
  });

  it("locks the scene while the GPU is unavailable", () => {
    setup(false, true);
    for (const label of ["Scene"]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
  });
});

it("selects the pointer tool", async () => {
  const { user, onChange } = setup();
  await user.click(screen.getByLabelText("Throw ball"));
  expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, tool: "throw" });
});

it("changes material toughness while paused without requiring a Reset", () => {
  const { onChange } = setup(true);
  const input = screen.getByRole("slider", {
    name: "Fracture energy (J/m²)",
  });
  expect(input).toBeEnabled();
  expect(input).toHaveAttribute("aria-valuetext", "7 J/m²");
  setRange(input, "2");
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_SETTINGS,
    material: {
      ...DEFAULT_SETTINGS.material,
      preset: "custom",
      customFractureEnergy: 100,
    },
  });
});

it("locks material editing when physics is unavailable", () => {
  setup(false, true);
  expect(
    screen.getByRole("slider", { name: "Fracture energy (J/m²)" }),
  ).toBeDisabled();
});

it.each([
  ["Gravity (m/s²)", "1.6", "gravity", 1.6],
  ["Areal density (kg/m²)", "50", "density", 50],
  ["Friction coefficient", "0", "friction", 0],
])("changes %s while paused", (label, input, key, value) => {
  const { onChange } = setup(true);
  const slider = screen.getByRole("slider", { name: label });
  expect(slider).toBeEnabled();
  setRange(slider, input);
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_SETTINGS,
    environment: { ...DEFAULT_SETTINGS.environment, [key]: value },
  });
});

it("locks world controls after a solver or GPU failure", () => {
  setup(false, true);
  for (const label of [
    "Gravity (m/s²)",
    "World scale",
    "Areal density (kg/m²)",
    "Friction coefficient",
  ])
    expect(screen.getByRole("slider", { name: label })).toBeDisabled();
});

it.each([
  ["Object width (m)", "4", { width: 4, height: 1 }],
  ["Object height (m)", "2.4", { width: 2, height: 2.4 }],
])("changes %s while paused", (label, value, objectSize) => {
  const { onChange } = setup(true);
  setRange(screen.getByRole("slider", { name: label }), value);
  expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, objectSize });
});

it.each(["pile", "stress"] as const)(
  "disables plate size controls in %s",
  (scene) => {
    setup(false, false, {}, { scene });
    expect(
      screen.getByRole("slider", { name: "Object width (m)" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("slider", { name: "Object height (m)" }),
    ).toBeDisabled();
  },
);

it("locks object size when physics is unavailable", () => {
  setup(false, true);
  expect(
    screen.getByRole("slider", { name: "Object width (m)" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("slider", { name: "Object height (m)" }),
  ).toBeDisabled();
});

it("scales both world dimensions and fits the object proportionally", () => {
  const { onChange } = setup(
    true,
    false,
    {},
    { objectSize: { width: 9, height: 5 } },
  );
  setRange(screen.getByRole("slider", { name: "World scale" }), "0.6");
  expect(onChange).toHaveBeenCalledOnce();
  const next = onChange.mock.calls[0]?.[0];
  expect(next?.environment).toEqual({
    ...DEFAULT_SETTINGS.environment,
    width: 6,
    height: 3.12,
  });
  expect(next?.objectSize.width).toBeCloseTo((9 * 3.02) / 5, 12);
  expect(next?.objectSize.height).toBeCloseTo(3.02, 12);
});
it("shows one world scale multiplier instead of separate dimension sliders", () => {
  setup(
    true,
    false,
    {},
    {
      environment: { ...DEFAULT_SETTINGS.environment, width: 18, height: 9.36 },
    },
  );
  expect(screen.getByRole("slider", { name: "World scale" })).toHaveValue(
    "1.8",
  );
  expect(screen.getByText("×1.8")).toBeVisible();
  expect(
    screen.queryByRole("slider", { name: "World width (m)" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("slider", { name: "World height (m)" }),
  ).not.toBeInTheDocument();
});

it("stores the selected initial object shape", async () => {
  const { user, onChange } = setup(true);
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Object shape" }),
    "triangle",
  );
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_SETTINGS,
    objectShape: "triangle",
    objectSize: { width: 2, height: Math.sqrt(3) },
  });
});

describe("reset buttons", () => {
  const moved: Partial<Settings> = {
    environment: {
      gravity: 3,
      width: 20,
      height: 10.4,
      density: 7,
      friction: 1.5,
    },
    objectShape: "hexagon",
    objectSize: { width: 1, height: 0.8 },
    material: { preset: "custom", customFractureEnergy: 50, thicknessMm: 3 },
    inertiaScale: 2,
    inertiaCap: 5,
    tiltSmoothing: 0.5,
  };

  it("disables every per-setting reset at the defaults", () => {
    setup(false, false, { enabled: true });
    const buttons = screen.getAllByRole("button", {
      name: /^Reset (?!parameters)/,
    });
    expect(buttons).toHaveLength(13);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  const cases: [string, Partial<Settings>][] = [
    [
      "Gravity (m/s²)",
      { environment: { ...DEFAULT_SETTINGS.environment, gravity: 3 } },
    ],
    [
      "World scale",
      {
        environment: {
          ...DEFAULT_SETTINGS.environment,
          width: 20,
          height: 10.4,
        },
      },
    ],
    [
      "Areal density (kg/m²)",
      { environment: { ...DEFAULT_SETTINGS.environment, density: 7 } },
    ],
    [
      "Friction coefficient",
      { environment: { ...DEFAULT_SETTINGS.environment, friction: 1.5 } },
    ],
    ["Object width (m)", { objectSize: { width: 1, height: 1 } }],
    ["Object height (m)", { objectSize: { width: 2, height: 0.8 } }],
    [
      "Fracture energy (J/m²)",
      {
        material: {
          ...DEFAULT_SETTINGS.material,
          preset: "custom",
          customFractureEnergy: 50,
        },
      },
    ],
    [
      "Thickness (mm)",
      { material: { ...DEFAULT_SETTINGS.material, thicknessMm: 3 } },
    ],
    ["Shake strength", { inertiaScale: 2 }],
    ["Shake limit", { inertiaCap: 5 }],
    ["Tilt smoothing", { tiltSmoothing: 0.5 }],
  ];

  it.each(cases)("resets only %s", async (label, patch) => {
    const { onChange, user } = setup(false, false, { enabled: true }, patch);
    await user.click(screen.getByRole("button", { name: `Reset ${label}` }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it("disables the motion resets while the device tilt is off", () => {
    setup(false, false, { enabled: false }, { inertiaScale: 2 });
    expect(
      screen.getByRole("button", { name: "Reset Shake strength" }),
    ).toBeDisabled();
  });

  it("locks Reset parameters with the rest of the panel", () => {
    setup(false, true);
    expect(
      screen.getByRole("button", { name: "Reset parameters" }),
    ).toBeDisabled();
  });

  it("resets the shape and the fracture preset", async () => {
    const { onChange, user } = setup(
      false,
      false,
      {},
      {
        objectShape: "hexagon",
        material: { ...DEFAULT_SETTINGS.material, preset: "ice" },
      },
    );
    await user.click(
      screen.getByRole("button", { name: "Reset Object shape" }),
    );
    expect(onChange.mock.calls[0]?.[0].objectShape).toBe("rectangle");
    await user.click(
      screen.getByRole("button", { name: "Reset Fracture preset" }),
    );
    expect(onChange.mock.calls[1]?.[0].material.preset).toBe("glass");
  });

  it("resets all parameters but keeps the scene and tool", async () => {
    const { onChange, user } = setup(
      false,
      false,
      {},
      {
        ...moved,
        scene: "pile",
        tool: "throw",
      },
    );
    await user.click(screen.getByRole("button", { name: "Reset parameters" }));
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      scene: "pile",
      tool: "throw",
    });
  });
});
