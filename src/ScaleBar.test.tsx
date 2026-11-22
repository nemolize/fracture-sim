import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { DEFAULT_ENVIRONMENT, withWorldScale } from "./rigid/environment";
import { ScaleBar } from "./ScaleBar";

it.each([
  { scale: 0.1, metres: 0.1 },
  { scale: 0.6, metres: 0.6 },
  { scale: 1, metres: 1 },
  { scale: 3, metres: 3 },
])("shows a physical reference at world scale $scale", ({ scale, metres }) => {
  const environment = withWorldScale(DEFAULT_ENVIRONMENT, scale);
  render(<ScaleBar environment={environment} />);
  expect(
    screen.getByRole("group", { name: "World scale reference" }),
  ).toHaveTextContent(`${String(metres)} m`);
  expect(
    screen.getByRole("img", { name: `${String(metres)} m scale bar` }),
  ).toHaveStyle({
    width: "10%",
  });
});

it("updates the physical length without changing bar width", () => {
  const { rerender } = render(<ScaleBar environment={DEFAULT_ENVIRONMENT} />);
  rerender(<ScaleBar environment={withWorldScale(DEFAULT_ENVIRONMENT, 3)} />);
  expect(
    screen.getByRole("group", { name: "World scale reference" }),
  ).toHaveTextContent("3 m");
  expect(screen.getByRole("img", { name: "3 m scale bar" })).toHaveStyle({
    width: "10%",
  });
  expect(
    screen.queryByRole("img", { name: "1 m scale bar" }),
  ).not.toBeInTheDocument();
});
