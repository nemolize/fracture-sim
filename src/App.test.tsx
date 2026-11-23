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
    resetToken,
    children,
  }: {
    resetToken: number;
    children?: React.ReactNode;
    onStats: (stats: WorldStats) => void;
    onContextUnavailable: (message: string) => void;
    onPhysicsError: (message: string) => void;
  }) => (
    <div aria-label="Fracture simulation" data-reset-token={resetToken}>
      {children}
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

const openSettings = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(screen.getByRole("button", { name: "Settings" }));
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

  it("locks Reset and the settings but not Pause", async () => {
    setGpu(undefined);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("alert");
    await openSettings(user);
    expect(
      screen.getByRole("combobox", { name: "Object shape" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Reset$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Pause$/ })).toBeEnabled();
  });
});

describe("with WebGPU", () => {
  it("keeps the settings in a popup that the Settings button toggles", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    const toggle = screen.getByRole("button", { name: "Settings" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox", { name: "Object shape" })).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("combobox", { name: "Object shape" }),
    ).toBeVisible();
    await user.click(toggle);
    expect(screen.queryByRole("combobox", { name: "Object shape" })).toBeNull();
  });

  it("keeps the popup open when Pause is pressed", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    await openSettings(user);
    await user.click(screen.getByRole("button", { name: /^Pause$/ }));
    expect(
      screen.getByRole("combobox", { name: "Object shape" }),
    ).toBeVisible();
  });

  it("closes the popup on Escape, ignores other keys and returns focus to the button", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    await openSettings(user);
    await user.keyboard("a");
    expect(
      screen.getByRole("combobox", { name: "Object shape" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox", { name: "Object shape" })).toBeNull();
    expect(screen.getByRole("button", { name: "Settings" })).toHaveFocus();
  });

  it("shows the statistics over the canvas without opening settings", async () => {
    setGpu(fakeGpu().gpu);
    render(<App />);
    expect(screen.getByRole("heading", { name: "Fracture Sim" })).toBeVisible();
    expect(await screen.findByLabelText("Fracture simulation")).toBeVisible();
    expect(screen.getByLabelText("Simulation statistics")).toHaveTextContent(
      "Bodies0",
    );
    await act(async () => {
      screen.getByRole("button", { name: "report stats" }).click();
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Simulation statistics")).toHaveTextContent(
      "Bodies3",
    );
  });

  it("selects the tool from the canvas overlay", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    await user.click(screen.getByRole("radio", { name: "Blast" }));
    expect(screen.getByRole("radio", { name: "Blast" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("radio", { name: "Blast" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByRole("radio", { name: "Blast" })).toBeEnabled();
  });

  it("wires the controls to the settings", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    await openSettings(user);
    const shape = screen.getByRole("combobox", { name: "Object shape" });
    await user.selectOptions(shape, "ellipse");
    expect(shape).toHaveValue("ellipse");
    await user.click(screen.getByRole("button", { name: /^Pause$/ }));
    expect(screen.getByRole("button", { name: /^Resume$/ })).toBeVisible();
  });

  it("keeps Reset on the screen and closes the popup on a tap outside it", async () => {
    setGpu(fakeGpu().gpu);
    const user = userEvent.setup();
    render(<App />);
    const canvas = await screen.findByLabelText("Fracture simulation");
    expect(canvas).toHaveAttribute("data-reset-token", "0");
    await user.click(screen.getByRole("button", { name: /^Reset$/ }));
    expect(canvas).toHaveAttribute("data-reset-token", "1");
    await openSettings(user);
    await user.click(screen.getByRole("combobox", { name: "Object shape" }));
    expect(
      screen.getByRole("combobox", { name: "Object shape" }),
    ).toBeVisible();
    await user.click(screen.getByRole("heading", { name: "Fracture Sim" }));
    expect(screen.queryByRole("combobox", { name: "Object shape" })).toBeNull();
  });

  it("stops and locks the controls when the device is lost", async () => {
    const fake = fakeGpu();
    setGpu(fake.gpu);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Fracture simulation");
    await openSettings(user);
    await act(async () => {
      fake.loseDevice("unknown", "the GPU process crashed");
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("The GPU stopped");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "the GPU process crashed",
    );
    expect(screen.queryByLabelText("Fracture simulation")).toBeNull();
    expect(screen.getByRole("button", { name: /^Reset$/ })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: /^Reset$/ })).toBeDisabled();
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
