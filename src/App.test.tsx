import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import App from "./App";

it("renders the canvas with its controls", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Fracture Sim" })).toBeVisible();
  expect(screen.getByLabelText("Fracture simulation")).toBeInTheDocument();
  expect(screen.getByLabelText("Simulation statistics")).toHaveTextContent(
    "0.0%",
  );
});

it("wires the controls to the settings", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(screen.getByLabelText("Material"), "glass");
  expect(screen.getByLabelText("Material")).toHaveValue("glass");
  await user.click(screen.getByRole("button", { name: "Pause" }));
  expect(screen.getByRole("button", { name: "Resume" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Reset" }));
});
