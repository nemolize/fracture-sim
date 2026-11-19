import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { MaterialControl } from "./MaterialControl";

it("maps the slider position to material toughness and exposes the physical value", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <MaterialControl value={1200} disabled={false} onChange={onChange} />,
  );
  const slider = screen.getByRole("slider", {
    name: "Fracture toughness (J/m)",
  });
  expect(slider).toHaveAttribute("aria-valuetext", "1,200 J/m");
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(slider, "2");
  fireEvent.input(slider);
  expect(onChange).toHaveBeenLastCalledWith(100);
  rerender(
    <MaterialControl value={100} disabled={false} onChange={onChange} />,
  );
  expect(slider).toHaveAttribute("aria-valuetext", "100 J/m");
});
