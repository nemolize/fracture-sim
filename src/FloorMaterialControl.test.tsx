import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { FloorMaterialControl } from "./FloorMaterialControl";
import {
  DEFAULT_FLOOR_MATERIAL,
  findFloorPreset,
  floorFromPreset,
} from "./sim/floor-material";

const setup = (value = DEFAULT_FLOOR_MATERIAL) => {
  const onChange = vi.fn();
  render(
    <FloorMaterialControl value={value} disabled={false} onChange={onChange} />,
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
const rubber = findFloorPreset("rubber");
if (rubber === undefined) throw new Error("Missing preset");

it("starts on the default floor", () => {
  setup();
  expect(
    screen.getByRole("combobox", { name: "Floor material preset" }),
  ).toHaveValue("default");
  expect(
    screen.getByRole("slider", { name: "Floor friction coefficient" }),
  ).toHaveValue("0.5");
  expect(
    screen.getByRole("slider", { name: "Floor restitution coefficient" }),
  ).toHaveValue("0");
});

it("loads a chosen preset", async () => {
  const { onChange, user } = setup();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Floor material preset" }),
    "rubber",
  );
  expect(onChange).toHaveBeenCalledWith(floorFromPreset(rubber));
});

it("keeps the values when Custom is selected", async () => {
  const { onChange, user } = setup();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Floor material preset" }),
    "custom",
  );
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_FLOOR_MATERIAL,
    preset: "custom",
  });
});

it.each([
  ["Floor friction coefficient", "1.5", { friction: 1.5 }],
  ["Floor restitution coefficient", "0.4", { restitution: 0.4 }],
])("switches to Custom when %s is adjusted", (name, value, patch) => {
  const { onChange } = setup();
  moveSlider(name, value);
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_FLOOR_MATERIAL,
    ...patch,
    preset: "custom",
  });
});

it.each([
  ["Floor friction coefficient", { friction: 1.5 }],
  ["Floor restitution coefficient", { restitution: 0.4 }],
])("resets %s to the default floor", async (name, patch) => {
  const { onChange, user } = setup({
    ...DEFAULT_FLOOR_MATERIAL,
    ...patch,
    preset: "custom",
  });
  await user.click(screen.getByRole("button", { name: `Reset ${name}` }));
  expect(onChange).toHaveBeenCalledWith(DEFAULT_FLOOR_MATERIAL);
});

it("resets the preset", async () => {
  const { onChange, user } = setup(floorFromPreset(rubber));
  await user.click(
    screen.getByRole("button", { name: "Reset Floor material preset" }),
  );
  expect(onChange).toHaveBeenCalledWith(DEFAULT_FLOOR_MATERIAL);
});

it("ignores an unknown select value", () => {
  const { onChange } = setup();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Floor material preset" }),
    { target: { value: "unknown" } },
  );
  expect(onChange).not.toHaveBeenCalled();
});
