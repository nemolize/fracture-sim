import { describe, expect, it, vi } from "vitest";

import {
  acquireGpu,
  ADAPTER_OPTIONS,
  gpuContext,
  watchDeviceLoss,
} from "./device";
import { fakeGpu } from "./fakes";

describe("acquireGpu", () => {
  it("is unavailable without navigator.gpu", async () => {
    expect(await acquireGpu({})).toEqual({
      status: "unavailable",
      reason: "navigator.gpu is not defined",
    });
  });

  it("is unavailable when requestAdapter returns null", async () => {
    const { gpu } = fakeGpu({ adapter: "none" });
    expect(await acquireGpu({ gpu })).toEqual({
      status: "unavailable",
      reason: "no GPU adapter was found",
    });
  });

  it("is unavailable when requestAdapter fails", async () => {
    const { gpu } = fakeGpu({ adapter: "throws" });
    expect(await acquireGpu({ gpu })).toEqual({
      status: "unavailable",
      reason: "requestAdapter failed: adapter refused",
    });
  });

  it("is unavailable when requestDevice fails", async () => {
    const { gpu } = fakeGpu({ device: "throws" });
    expect(await acquireGpu({ gpu })).toEqual({
      status: "unavailable",
      reason: "requestDevice failed: device refused",
    });
  });

  it("describes a failure that is not an Error by its text", async () => {
    const { gpu } = fakeGpu({ adapter: "throws-text" });
    expect(await acquireGpu({ gpu })).toEqual({
      status: "unavailable",
      reason: "requestAdapter failed: nope",
    });
  });

  it("returns the device and a summary of the adapter", async () => {
    const { gpu, device, requestAdapter } = fakeGpu();
    const state = await acquireGpu({ gpu });
    expect(requestAdapter).toHaveBeenCalledWith(ADAPTER_OPTIONS);
    expect(state).toEqual({
      status: "ready",
      device,
      adapter: {
        vendor: "acme",
        architecture: "gpu-1",
        description: "Fake GPU",
        isFallback: false,
      },
    });
  });
});

describe("watchDeviceLoss", () => {
  it("reports a lost device with the browser's message", async () => {
    const fake = fakeGpu();
    const onLost = vi.fn();
    watchDeviceLoss(fake.device, onLost);
    fake.loseDevice("unknown", "the GPU process crashed");
    await Promise.resolve();
    await Promise.resolve();
    expect(onLost).toHaveBeenCalledWith("the GPU process crashed");
  });

  it("stays quiet when the page destroys the device itself", async () => {
    const fake = fakeGpu();
    const onLost = vi.fn();
    watchDeviceLoss(fake.device, onLost);
    fake.loseDevice("destroyed", "destroyed");
    await Promise.resolve();
    await Promise.resolve();
    expect(onLost).not.toHaveBeenCalled();
  });
});

describe("gpuContext", () => {
  const context = { configure: vi.fn(), getCurrentTexture: vi.fn() };

  it("returns the context a canvas gives for webgpu", () => {
    const getContext = vi.fn(() => context);
    expect(gpuContext({ getContext })).toBe(context);
    expect(getContext).toHaveBeenCalledWith("webgpu");
  });

  it.each([null, undefined, 3, {}, { configure: () => undefined }])(
    "is null when the canvas gives %j",
    (value) => {
      expect(gpuContext({ getContext: () => value })).toBeNull();
    },
  );
});
