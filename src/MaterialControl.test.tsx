import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { MaterialControl } from "./MaterialControl";
import {
  DEFAULT_MATERIAL,
  findMaterialPreset,
  materialFromPreset,
} from "./sim/material";

const setup = (value = DEFAULT_MATERIAL) => {
  const onChange = vi.fn();
  render(
    <MaterialControl value={value} disabled={false} onChange={onChange} />,
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
const ice = findMaterialPreset("ice");
if (ice === undefined) throw new Error("Missing preset");

it("shows real glass values, plate thickness and the derived energies initially", () => {
  setup();
  expect(
    screen.getByRole("combobox", { name: "Object material preset" }),
  ).toHaveValue("glass");
  expect(
    screen.getByRole("slider", { name: "Fracture energy (J/m²)" }),
  ).toHaveAttribute("aria-valuetext", "7 J/m²");
  expect(
    screen.getByRole("slider", { name: "Object density (kg/m³)" }),
  ).toHaveValue("2500");
  expect(
    screen.getByRole("slider", { name: "Object friction coefficient" }),
  ).toHaveValue("0.5");
  expect(
    screen.getByRole("slider", { name: "Object restitution coefficient" }),
  ).toHaveValue("0");
  expect(screen.getByRole("slider", { name: "Thickness (mm)" })).toHaveValue(
    "10",
  );
  expect(
    screen.getByRole("status", { name: "Areal density" }),
  ).toHaveTextContent("25 kg/m²");
  expect(
    screen.getByRole("status", { name: "Crack energy" }),
  ).toHaveTextContent("0.07 J/m");
});

it("loads every property of a chosen preset and keeps the thickness", async () => {
  const { onChange, user } = setup({ ...DEFAULT_MATERIAL, thicknessMm: 4 });
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Object material preset" }),
    "ice",
  );
  expect(onChange).toHaveBeenCalledWith(
    materialFromPreset(ice, { ...DEFAULT_MATERIAL, thicknessMm: 4 }),
  );
});

it("keeps the values when Custom is selected", async () => {
  const { onChange, user } = setup();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Object material preset" }),
    "custom",
  );
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_MATERIAL,
    preset: "custom",
  });
});

it.each([
  ["Fracture energy (J/m²)", "2", { fractureEnergy: 100 }],
  ["Object density (kg/m³)", "1000", { density: 1000 }],
  ["Object friction coefficient", "0.9", { friction: 0.9 }],
  ["Object restitution coefficient", "0.4", { restitution: 0.4 }],
])("switches to Custom when %s is adjusted", (name, value, patch) => {
  const { onChange } = setup();
  moveSlider(name, value);
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_MATERIAL,
    ...patch,
    preset: "custom",
  });
});

it("names the preset again when the sliders land on its values", () => {
  const { onChange } = setup({
    ...DEFAULT_MATERIAL,
    preset: "custom",
    density: 1000,
  });
  moveSlider("Object density (kg/m³)", "2500");
  expect(onChange).toHaveBeenCalledWith(DEFAULT_MATERIAL);
});

it("adjusts thickness while retaining the selected material", () => {
  const { onChange } = setup();
  moveSlider("Thickness (mm)", "20");
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_MATERIAL,
    thicknessMm: 20,
  });
});

it("resets thickness without changing the material", async () => {
  const { onChange, user } = setup({ ...DEFAULT_MATERIAL, thicknessMm: 20 });
  await user.click(
    screen.getByRole("button", { name: "Reset Thickness (mm)" }),
  );
  expect(onChange).toHaveBeenCalledWith(DEFAULT_MATERIAL);
});

it("resets the preset to glass, keeping the thickness", async () => {
  const { onChange, user } = setup({
    ...materialFromPreset(ice, { ...DEFAULT_MATERIAL, thicknessMm: 4 }),
  });
  await user.click(
    screen.getByRole("button", { name: "Reset Object material preset" }),
  );
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_MATERIAL,
    thicknessMm: 4,
  });
});

it("ignores an unknown select value", () => {
  const { onChange } = setup();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Object material preset" }),
    { target: { value: "unknown" } },
  );
  expect(onChange).not.toHaveBeenCalled();
});

it("adjusts the minimum fragment area on a log scale", () => {
  const { onChange } = setup();
  moveSlider("Min fragment area (m²)", "-4");
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_MATERIAL,
    minFragmentArea: 10 ** -4,
  });
});

it("shows the default minimum fragment area of 0.001 m²", () => {
  setup();
  expect(
    screen.getByRole("slider", { name: "Min fragment area (m²)" }),
  ).toHaveAttribute("aria-valuetext", "0.001 m²");
});

it("resets the minimum fragment area to the default", async () => {
  const onChange = vi.fn();
  const changed = { ...DEFAULT_MATERIAL, minFragmentArea: 0.01 };
  render(
    <MaterialControl value={changed} disabled={false} onChange={onChange} />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Reset Min fragment area (m²)" }),
  );
  expect(onChange).toHaveBeenCalledWith(DEFAULT_MATERIAL);
});
