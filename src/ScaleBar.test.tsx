import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { DEFAULT_ENVIRONMENT, withWorldScale } from "./rigid/environment";
import { ScaleBar } from "./ScaleBar";

it.each([
  { scale: 0.6, metres: 1 },
  { scale: 1, metres: 2 },
  { scale: 3, metres: 5 },
])("shows a physical reference at world scale $scale", ({ scale, metres }) => {
  const environment = withWorldScale(DEFAULT_ENVIRONMENT, scale);
  render(<ScaleBar environment={environment} />);
  expect(
    screen.getByRole("group", { name: "World scale reference" }),
  ).toHaveTextContent(`${String(metres)} m · ×${scale.toFixed(1)}`);
  expect(
    screen.getByRole("img", { name: `${String(metres)} m scale bar` }),
  ).toHaveStyle({
    width: `${String((metres / (10 * scale)) * 100)}%`,
  });
});

it("updates the bar and multiplier when world scale changes", () => {
  const { rerender } = render(<ScaleBar environment={DEFAULT_ENVIRONMENT} />);
  rerender(<ScaleBar environment={withWorldScale(DEFAULT_ENVIRONMENT, 3)} />);
  expect(
    screen.getByRole("group", { name: "World scale reference" }),
  ).toHaveTextContent("5 m · ×3.0");
  expect(
    screen.queryByRole("img", { name: "2 m scale bar" }),
  ).not.toBeInTheDocument();
});
