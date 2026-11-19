import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeGpu } from "@/gpu/fakes";
import type { WorldStats } from "@/rigid/types";

import App from "./App";

// The real canvas needs a WebGPU device; its own e2e test drives it.
vi.mock("@/FractureCanvas", () => ({
  FractureCanvas: ({
    onStats,
    onContextUnavailable,
    onPhysicsError,
  }: {
    onStats: (stats: WorldStats) => void;
    onContextUnavailable: (message: string) => void;
    onPhysicsError: (message: string) => void;
  }) => (
    <div aria-label="Fracture simulation">
      <button
        type="button"
        onClick={() => {
          onPhysicsError("WASM failed");
        }}
      >
        report physics failure
      </button>
      <button
        type="button"
        onClick={() => {
          onStats({ mass: 50, bodies: 3, sleeping: 2, stepMs: 0.1, time: 1 });
        }}
      >
        report stats
      </button>
      <button
        type="button"
        onClick={() => {
          onContextUnavailable("no context");
        }}
      >
        report failure
      </button>
    </div>
  ),
}));

const setGpu = (value: unknown): void => {
  Object.defineProperty(navigator, "gpu", { value, configurable: true });
};

afterEach(() => {
  Reflect.deleteProperty(navigator, "gpu");
});

describe("without WebGPU", () => {
  it.each([
    ["navigator.gpu is missing", undefined],
    ["there is no adapter", fakeGpu({ adapter: "none" }).gpu],
    ["the adapter request fails", fakeGpu({ adapter: "throws" }).gpu],
    ["the device request fails", fakeGpu({ device: "throws" }).gpu],
  ])("shows the requirement and starts nothing when %s", async (_, gpu) => {
    setGpu(gpu);
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "WebGPU is required",
    );
    expect(screen.queryByLabelText("Fracture simulation")).toBeNull();
  });

  it("locks Reset and scene but not Pause", async () => {
    setGpu(undefined);
    render(<App />);
    await screen.findByRole("alert");
    for (const label of ["Scene"]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
  });
});

describe("with WebGPU", () => {
  it("renders the canvas with its controls and the statistics", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { name: "Fracture Sim" })).toBeVisible();
    expect(await screen.findByLabelText("Fracture simulation")).toBeVisible();
    expect(screen.getByLabelText("Simulation statistics")).toHaveTextContent(
      "Bodies0",
    );
    await user.click(screen.getByRole("button", { name: "report stats" }));
    expect(screen.getByLabelText("Simulation statistics")).toHaveTextContent(
      "Bodies3",
    );
  });

  it("wires the controls to the settings", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    await user.selectOptions(screen.getByLabelText("Scene"), "pile");
    expect(screen.getByLabelText("Scene")).toHaveValue("pile");
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset" }));
  });

  it("stops and locks the controls when the device is lost", async () => {
    const fake = fakeGpu();
    setGpu(fake.gpu);
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    await act(async () => {
      fake.loseDevice("unknown", "the GPU process crashed");
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("The GPU stopped");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "the GPU process crashed",
    );
    expect(screen.queryByLabelText("Fracture simulation")).toBeNull();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("keeps running when the page destroys the device itself", async () => {
    const fake = fakeGpu();
    setGpu(fake.gpu);
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    await act(async () => {
      fake.loseDevice("destroyed", "destroyed");
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Fracture simulation")).toBeVisible();
  });

  it("says WebGPU is required when the canvas cannot use it", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "report failure" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("WebGPU is required");
    expect(screen.getByRole("alert")).toHaveTextContent("no context");
    expect(screen.queryByLabelText("Fracture simulation")).toBeNull();
  });

  it("stops and explains a physics worker failure", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "report physics failure" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The physics stopped");
    expect(screen.getByRole("alert")).toHaveTextContent("WASM failed");
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("releases a device that arrives after the page is gone", async () => {
    const fake = fakeGpu();
    setGpu(fake.gpu);
    const { unmount } = render(<App />);
    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fake.destroy).toHaveBeenCalledOnce();
  });

  it("has nothing to release when an unavailable result arrives after the page is gone", async () => {
    const fake = fakeGpu({ adapter: "none" });
    setGpu(fake.gpu);
    const { unmount } = render(<App />);
    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fake.destroy).not.toHaveBeenCalled();
  });
});
