import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ObjectControl } from "./ObjectControl";
import { DEFAULT_ENVIRONMENT } from "./rigid/environment";
import { DEFAULT_OBJECT_SIZE } from "./rigid/object-size";

it.each(["ellipse", "triangle", "hexagon"])("selects %s", async (shape) => {
  const onShapeChange = vi.fn();
  render(
    <ObjectControl
      value={DEFAULT_OBJECT_SIZE}
      bounds={DEFAULT_ENVIRONMENT}
      disabled={false}
      shape="rectangle"
      onShapeChange={onShapeChange}
      onChange={vi.fn()}
    />,
  );
  await userEvent
    .setup()
    .selectOptions(
      screen.getByRole("combobox", { name: "Object shape" }),
      shape,
    );
  expect(onShapeChange).toHaveBeenCalledWith(shape);
});
it("ignores unknown selections", () => {
  const onShapeChange = vi.fn();
  render(
    <ObjectControl
      value={DEFAULT_OBJECT_SIZE}
      bounds={DEFAULT_ENVIRONMENT}
      disabled={false}
      shape="rectangle"
      onShapeChange={onShapeChange}
      onChange={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Object shape" }), {
    target: { value: "unknown" },
  });
  expect(onShapeChange).not.toHaveBeenCalled();
});
