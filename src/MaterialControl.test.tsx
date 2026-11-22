import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { MaterialControl } from "./MaterialControl";
import { DEFAULT_MATERIAL } from "./sim/material";

const setup = () => {
  const onChange = vi.fn();
  render(
    <MaterialControl
      value={DEFAULT_MATERIAL}
      disabled={false}
      onChange={onChange}
    />,
  );
  return { onChange, user: userEvent.setup() };
};
const moveSlider = (name: string, value: string): void => {
  const slider = screen.getByRole("slider", { name });
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(slider, value);
  fireEvent.input(slider);
};

it("shows real glass energy, plate thickness and derived crack energy initially", () => {
  setup();
  expect(screen.getByRole("combobox", { name: "Fracture preset" })).toHaveValue(
    "glass",
  );
  expect(
    screen.getByRole("slider", { name: "Fracture energy (J/m²)" }),
  ).toHaveAttribute("aria-valuetext", "7 J/m²");
  expect(screen.getByRole("slider", { name: "Thickness (mm)" })).toHaveValue(
    "10",
  );
  expect(
    screen.getByRole("status", { name: "Crack energy" }),
  ).toHaveTextContent("0.07 J/m");
});

it.each(["ice", "custom"])(
  "selects %s without changing the thickness",
  async (preset) => {
    const { onChange, user } = setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Fracture preset" }),
      preset,
    );
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_MATERIAL, preset });
  },
);

it("switches to Custom when the fracture-energy slider is adjusted", () => {
  const { onChange } = setup();
  moveSlider("Fracture energy (J/m²)", "2");
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_MATERIAL,
    preset: "custom",
    customFractureEnergy: 100,
  });
});

it("adjusts thickness while retaining the selected material", () => {
  const { onChange } = setup();
  moveSlider("Thickness (mm)", "20");
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_MATERIAL,
    thicknessMm: 20,
  });
});

it("ignores an unknown select value", () => {
  const { onChange } = setup();
  fireEvent.change(screen.getByRole("combobox", { name: "Fracture preset" }), {
    target: { value: "unknown" },
  });
  expect(onChange).not.toHaveBeenCalled();
});

it.each([
  ["-3", 10 ** -3],
  ["-1", 10 ** -1],
])("adjusts the minimum fragment area to log10 %s", (position, area) => {
  const { onChange } = setup();
  moveSlider("Min fragment area (m²)", position);
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_MATERIAL,
    minFragmentArea: area,
  });
});

it("limits the minimum fragment area slider to 0.001–0.1 m²", () => {
  setup();
  const slider = screen.getByRole("slider", { name: "Min fragment area (m²)" });
  expect(slider).toHaveAttribute("aria-valuemin", "0.001");
  expect(slider).toHaveAttribute("aria-valuemax", "0.1");
});

it("shows the default minimum fragment area of 0.01 m²", () => {
  setup();
  expect(
    screen.getByRole("slider", { name: "Min fragment area (m²)" }),
  ).toHaveAttribute("aria-valuetext", "0.01 m²");
});

it("resets the minimum fragment area to the default", async () => {
  const onChange = vi.fn();
  const changed = { ...DEFAULT_MATERIAL, minFragmentArea: 0.05 };
  render(
    <MaterialControl value={changed} disabled={false} onChange={onChange} />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Reset Min fragment area (m²)" }),
  );
  expect(onChange).toHaveBeenCalledWith(DEFAULT_MATERIAL);
});
