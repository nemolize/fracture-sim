import { existsSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

/**
 * Chromium flags that give headless Chromium a WebGPU adapter without a GPU:
 * SwiftShader, the software Vulkan implementation bundled with the browser.
 * `E2E_WEBGPU=hardware` drops them to measure on the machine's own GPU.
 */
const hardware = process.env["E2E_WEBGPU"] === "hardware";

export const webgpuArgs = hardware
  ? ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"]
  : [
      "--enable-unsafe-webgpu",
      "--use-webgpu-adapter=swiftshader",
      "--use-angle=swiftshader",
      "--use-gl=angle",
      "--enable-features=Vulkan",
      "--ignore-gpu-blocklist",
      "--disable-vulkan-surface",
    ];

const icd = path.join(
  path.dirname(chromium.executablePath()),
  "vk_swiftshader_icd.json",
);

/**
 * Chromium's own Vulkan setup cannot find SwiftShader on Linux unless told
 * where its driver file is. Without it the shared image behind a WebGPU canvas
 * cannot be created, and every `mapAsync` on a device fails once a frame has
 * been drawn to the canvas.
 */
export const webgpuEnv: Record<string, string> =
  !hardware && existsSync(icd) ? { VK_ICD_FILENAMES: icd } : {};
