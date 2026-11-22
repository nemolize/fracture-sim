import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { StatsReadout } from "./StatsReadout";

it("shows the body counts and the step time without capturing pointers", () => {
  render(
    <StatsReadout
      stats={{ mass: 1, bodies: 240, sleeping: 7, stepMs: 4.8, time: 0 }}
    />,
  );
  const stats = screen.getByLabelText("Simulation statistics");
  expect(stats).toHaveTextContent("Bodies240");
  expect(stats).toHaveTextContent("Sleeping7");
  expect(stats).toHaveTextContent("Physics step4.80 ms");
  expect(stats).toHaveClass("pointer-events-none");
});

it("keeps a minimum width so changing values do not resize the panel", () => {
  render(
    <StatsReadout
      stats={{ mass: 1, bodies: 1, sleeping: 0, stepMs: 4.8, time: 0 }}
    />,
  );
  expect(screen.getByLabelText("Simulation statistics")).toHaveClass(
    "min-w-48",
  );
});
