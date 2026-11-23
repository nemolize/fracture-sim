import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { DEFAULT_MATERIAL } from "@/sim/material";

import { StatsReadout } from "./StatsReadout";

const frameRate = vi.hoisted(() => {
  const state: { value: number | null } = { value: 59.6 };
  return state;
});
vi.mock("@/useFrameRate", () => ({ useFrameRate: () => frameRate.value }));

it("shows the frame rate, body counts, step time and material readouts without capturing pointers", () => {
  render(
    <StatsReadout
      stats={{ mass: 1, bodies: 240, sleeping: 7, stepMs: 4.8, time: 0 }}
      material={DEFAULT_MATERIAL}
    />,
  );
  const stats = screen.getByLabelText("Simulation statistics");
  expect(stats).toHaveTextContent("Bodies240");
  expect(stats).toHaveTextContent("Sleeping7");
  expect(stats).toHaveTextContent("Physics step4.80 ms");
  expect(stats).toHaveTextContent("Frame rate60 fps");
  expect(stats).toHaveTextContent("Areal density25 kg/m²");
  expect(stats).toHaveTextContent("Crack energy0.07 J/m");
  expect(stats).toHaveClass("pointer-events-none");
});

it("keeps a minimum width so changing values do not resize the panel", () => {
  render(
    <StatsReadout
      stats={{ mass: 1, bodies: 1, sleeping: 0, stepMs: 4.8, time: 0 }}
      material={DEFAULT_MATERIAL}
    />,
  );
  expect(screen.getByLabelText("Simulation statistics")).toHaveClass(
    "min-w-48",
  );
});

it("shows a dash for the frame rate until one is measured", () => {
  frameRate.value = null;
  render(
    <StatsReadout
      stats={{ mass: 1, bodies: 1, sleeping: 0, stepMs: 4.8, time: 0 }}
      material={DEFAULT_MATERIAL}
    />,
  );
  expect(screen.getByLabelText("Simulation statistics")).toHaveTextContent(
    "Frame rate–",
  );
  frameRate.value = 59.6;
});
