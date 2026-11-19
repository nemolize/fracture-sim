import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import { MaterialControl } from "./MaterialControl";

it("lets a number be cleared and replaced, retaining the last valid material on blur", () => {
  const onChange = vi.fn();
  const Fixture = () => {
    const [value, setValue] = useState(1200);
    return (
      <MaterialControl
        value={value}
        disabled={false}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  };
  render(<Fixture />);
  const input = screen.getByLabelText("Fracture toughness (J/m)");
  fireEvent.change(input, { target: { value: "" } });
  expect(input).toHaveValue(null);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(input).toHaveValue(1200);
  fireEvent.change(input, { target: { value: "-1" } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "12.5" } });
  expect(onChange).toHaveBeenLastCalledWith(12.5);
  fireEvent.change(input, { target: { value: "0" } });
  fireEvent.blur(input);
  expect(input).toHaveValue(12.5);
});
