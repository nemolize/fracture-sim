import { vi } from "vitest";

/** Test doubles for the WebGPU entry points `acquireGpu` and `useGpu` call. */
export interface FakeGpu {
  gpu: GPU;
  device: GPUDevice;
  destroy: ReturnType<typeof vi.fn>;
  loseDevice: (reason: GPUDeviceLostReason, message: string) => void;
  requestAdapter: ReturnType<typeof vi.fn>;
}

type AdapterBehaviour = "none" | "throws" | "throws-text";

export const fakeGpu = (
  options: { adapter?: AdapterBehaviour; device?: "throws" } = {},
): FakeGpu => {
  let lose: (info: GPUDeviceLostInfo) => void = () => undefined;
  const lost = new Promise<GPUDeviceLostInfo>((resolve) => {
    lose = resolve;
  });
  const device = { destroy: vi.fn(), lost };
  const adapter = {
    info: {
      vendor: "acme",
      architecture: "gpu-1",
      description: "Fake GPU",
      isFallbackAdapter: false,
    },
    requestDevice:
      options.device === "throws"
        ? vi.fn(() => Promise.reject(new Error("device refused")))
        : vi.fn(() => Promise.resolve(device)),
  };
  const requestAdapter = vi.fn(() => {
    if (options.adapter === "throws") {
      return Promise.reject(new Error("adapter refused"));
    }
    if (options.adapter === "throws-text") {
      // A rejection that is not an Error is the case under test.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject("nope");
    }
    return Promise.resolve(options.adapter === "none" ? null : adapter);
  });
  // The doubles carry only the members the code under test touches, and the
  // real interfaces are far larger than a test should build.
  /* eslint-disable @typescript-eslint/consistent-type-assertions */
  return {
    gpu: { requestAdapter } as unknown as GPU,
    device: device as unknown as GPUDevice,
    destroy: device.destroy,
    loseDevice: (reason, message) => {
      lose({ reason, message });
    },
    requestAdapter,
  };
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
};
