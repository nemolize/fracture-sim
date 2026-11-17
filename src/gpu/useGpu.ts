import { useCallback, useEffect, useState } from "react";

import { acquireGpu, type GpuState, watchDeviceLoss } from "./device";

export type GpuStatus =
  { status: "checking" } | GpuState | { status: "lost"; message: string };

/**
 * Acquires the WebGPU device once. A lost device is terminal: nothing restarts
 * it, so the page keeps showing the message until it is reloaded.
 */
export const useGpu = (): {
  gpu: GpuStatus;
  fail: (message: string) => void;
} => {
  const [gpu, setGpu] = useState<GpuStatus>({ status: "checking" });
  const fail = useCallback((message: string) => {
    setGpu({ status: "lost", message });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void acquireGpu(navigator).then((result) => {
      if (cancelled) {
        if (result.status === "ready") result.device.destroy();
        return;
      }
      if (result.status === "ready") watchDeviceLoss(result.device, fail);
      setGpu(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fail]);

  return { gpu, fail };
};
