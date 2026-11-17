/** Used by the app and by the e2e probe, so both ask for the same kind of adapter. */
export const ADAPTER_OPTIONS: GPURequestAdapterOptions = {
  powerPreference: "high-performance",
};

interface AdapterSummary {
  vendor: string;
  architecture: string;
  description: string;
  isFallback: boolean;
}

export type GpuState =
  | { status: "ready"; device: GPUDevice; adapter: AdapterSummary }
  | { status: "unavailable"; reason: string };

const unavailable = (reason: string): GpuState => ({
  status: "unavailable",
  reason,
});

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The one definition of "WebGPU available": `navigator.gpu` exists,
 * `requestAdapter()` returns an adapter and `requestDevice()` succeeds.
 */
export const acquireGpu = async (host: {
  gpu?: GPU | undefined;
}): Promise<GpuState> => {
  const { gpu } = host;
  if (gpu === undefined) return unavailable("navigator.gpu is not defined");
  let adapter: GPUAdapter | null;
  try {
    adapter = await gpu.requestAdapter(ADAPTER_OPTIONS);
  } catch (error) {
    return unavailable(`requestAdapter failed: ${describe(error)}`);
  }
  if (adapter === null) return unavailable("no GPU adapter was found");
  try {
    const device = await adapter.requestDevice();
    const { vendor, architecture, description, isFallbackAdapter } =
      adapter.info;
    return {
      status: "ready",
      device,
      adapter: {
        vendor,
        architecture,
        description,
        isFallback: isFallbackAdapter,
      },
    };
  } catch (error) {
    return unavailable(`requestDevice failed: ${describe(error)}`);
  }
};

/** Calls `onLost` with the browser's message when the device is lost for any reason but `destroy()`. */
export const watchDeviceLoss = (
  device: GPUDevice,
  onLost: (message: string) => void,
): void => {
  void device.lost.then((info) => {
    if (info.reason !== "destroyed") onLost(info.message);
  });
};

const isGpuContext = (value: unknown): value is GPUCanvasContext =>
  typeof value === "object" &&
  value !== null &&
  "configure" in value &&
  "getCurrentTexture" in value;

/** The canvas's WebGPU context, or null when it cannot give one. */
export const gpuContext = (canvas: {
  getContext: (id: string) => unknown;
}): GPUCanvasContext | null => {
  const context = canvas.getContext("webgpu");
  return isGpuContext(context) ? context : null;
};
