import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ControlPanel } from "./ControlPanel";
import { withWorldScale } from "./rigid/environment";
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
  locked = false,
  motion: Partial<Parameters<typeof ControlPanel>[0]["motion"]> = {},
  settings: Partial<Settings> = {},
) => {
  const onChange = vi.fn<(next: Settings) => void>();
  const setEnabled = vi.fn();
  render(
    <ControlPanel
      settings={{ ...DEFAULT_SETTINGS, ...settings }}
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
      const { setEnabled, user } = setup(false, { enabled: true });
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
        setup(false, { support });
        expect(screen.getByLabelText("Device tilt")).toBeDisabled();
        expect(screen.getByText(text)).toBeVisible();
      },
    );

    it("shows the reason the toggle went back off", () => {
      setup(false, { notice: "Motion access was denied." });
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
      const { onChange } = setup(false, { enabled: true });
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
    setup(true);
    for (const label of ["Scene"]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
  });
});

it("changes material toughness without requiring a Reset", () => {
  const { onChange } = setup();
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
      fractureEnergy: 100,
    },
  });
});

it("locks material editing when physics is unavailable", () => {
  setup(true);
  expect(
    screen.getByRole("slider", { name: "Fracture energy (J/m²)" }),
  ).toBeDisabled();
});

it.each([["Gravity (m/s²)", "1.6", "gravity", 1.6]])(
  "changes %s",
  (label, input, key, value) => {
    const { onChange } = setup();
    const slider = screen.getByRole("slider", { name: label });
    expect(slider).toBeEnabled();
    setRange(slider, input);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      environment: { ...DEFAULT_SETTINGS.environment, [key]: value },
    });
  },
);

it("locks world controls after a solver or GPU failure", () => {
  setup(true);
  for (const label of [
    "Gravity (m/s²)",
    "World scale",
    "Object density (kg/m³)",
    "Object friction coefficient",
    "Object restitution coefficient",
    "Floor friction coefficient",
    "Floor restitution coefficient",
  ])
    expect(screen.getByRole("slider", { name: label })).toBeDisabled();
});

it.each([
  ["Object width (m)", "1.5", { width: 1.5, height: 0.5 }],
  ["Object height (m)", "0.9", { width: 0.5, height: 0.9 }],
])("changes %s", (label, value, objectSize) => {
  const { onChange } = setup();
  setRange(screen.getByRole("slider", { name: label }), value);
  expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, objectSize });
});

it.each(["pile", "stress"] as const)(
  "disables plate size controls in %s",
  (scene) => {
    setup(false, {}, { scene });
    expect(
      screen.getByRole("slider", { name: "Object width (m)" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("slider", { name: "Object height (m)" }),
    ).toBeDisabled();
  },
);

it("locks object size when physics is unavailable", () => {
  setup(true);
  expect(
    screen.getByRole("slider", { name: "Object width (m)" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("slider", { name: "Object height (m)" }),
  ).toBeDisabled();
});

it("scales both world dimensions and fits the object proportionally", () => {
  const { onChange } = setup(
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
    false,
    {},
    {
      environment: { ...DEFAULT_SETTINGS.environment, width: 18, height: 9.36 },
    },
  );
  expect(screen.getByRole("slider", { name: "World scale" })).toHaveValue(
    "1.8",
  );
  expect(screen.getByText("×1.80")).toBeVisible();
  expect(
    screen.queryByRole("slider", { name: "World width (m)" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("slider", { name: "World height (m)" }),
  ).not.toBeInTheDocument();
});

it("stores the selected initial object shape", async () => {
  const { user, onChange } = setup();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Object shape" }),
    "triangle",
  );
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_SETTINGS,
    objectShape: "triangle",
    objectSize: { width: 0.5, height: Math.sqrt(3) / 4 },
  });
});

describe("reset buttons", () => {
  const moved: Partial<Settings> = {
    environment: {
      gravity: 3,
      width: 20,
      height: 10.4,
    },
    objectShape: "hexagon",
    objectSize: { width: 1, height: 0.8 },
    material: {
      ...DEFAULT_SETTINGS.material,
      preset: "custom",
      fractureEnergy: 50,
      thicknessMm: 3,
    },
    floorMaterial: { preset: "custom", friction: 1.2, restitution: 0.5 },
    inertiaScale: 2,
    inertiaCap: 5,
    tiltSmoothing: 0.5,
  };

  it("disables every per-setting reset at the defaults", () => {
    setup(false, { enabled: true });
    const buttons = screen.getAllByRole("button", {
      name: /^Reset (?!parameters)/,
    });
    expect(buttons).toHaveLength(18);
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
      "Object density (kg/m³)",
      { material: { ...DEFAULT_SETTINGS.material, density: 900 } },
    ],
    [
      "Object friction coefficient",
      { material: { ...DEFAULT_SETTINGS.material, friction: 0.1 } },
    ],
    [
      "Object restitution coefficient",
      { material: { ...DEFAULT_SETTINGS.material, restitution: 0.5 } },
    ],
    [
      "Floor friction coefficient",
      { floorMaterial: { ...DEFAULT_SETTINGS.floorMaterial, friction: 1.5 } },
    ],
    [
      "Floor restitution coefficient",
      {
        floorMaterial: { ...DEFAULT_SETTINGS.floorMaterial, restitution: 0.5 },
      },
    ],
    ["Object width (m)", { objectSize: { width: 1, height: 0.5 } }],
    ["Object height (m)", { objectSize: { width: 0.5, height: 0.8 } }],
    [
      "Fracture energy (J/m²)",
      {
        material: {
          ...DEFAULT_SETTINGS.material,
          preset: "custom",
          fractureEnergy: 50,
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
    const { onChange, user } = setup(false, { enabled: true }, patch);
    await user.click(screen.getByRole("button", { name: `Reset ${label}` }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it("resets an object axis to the default fitted to a small world", async () => {
    const small = withWorldScale(DEFAULT_SETTINGS.environment, 0.1);
    const { onChange, user } = setup(
      false,
      { enabled: true },
      { environment: small, objectSize: { width: 0.42, height: 0.3 } },
    );
    await user.click(
      screen.getByRole("button", { name: "Reset Object height (m)" }),
    );
    const next = onChange.mock.calls[0]?.[0];
    expect(next?.objectSize.height).toBeCloseTo(0.42, 6);
  });

  it("disables the motion resets while the device tilt is off", () => {
    setup(false, { enabled: false }, { inertiaScale: 2 });
    expect(
      screen.getByRole("button", { name: "Reset Shake strength" }),
    ).toBeDisabled();
  });

  it("locks Reset parameters with the rest of the panel", () => {
    setup(true);
    expect(
      screen.getByRole("button", { name: "Reset parameters" }),
    ).toBeDisabled();
  });

  it("resets the shape and both material presets", async () => {
    const { onChange, user } = setup(
      false,
      {},
      {
        objectShape: "hexagon",
        material: { ...DEFAULT_SETTINGS.material, preset: "ice" },
        floorMaterial: {
          preset: "wood",
          friction: 0.5,
          restitution: 0.3,
        },
      },
    );
    await user.click(
      screen.getByRole("button", { name: "Reset Object shape" }),
    );
    expect(onChange.mock.calls[0]?.[0].objectShape).toBe("rectangle");
    await user.click(
      screen.getByRole("button", { name: "Reset Object material preset" }),
    );
    expect(onChange.mock.calls[1]?.[0].material.preset).toBe("glass");
    await user.click(
      screen.getByRole("button", { name: "Reset Floor material preset" }),
    );
    expect(onChange.mock.calls[2]?.[0].floorMaterial.preset).toBe("default");
  });

  it("resets all parameters but keeps the scene and tool", async () => {
    const { onChange, user } = setup(
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
