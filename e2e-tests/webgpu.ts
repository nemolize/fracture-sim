/**
 * Chromium flags that give headless Chromium a WebGPU adapter without a GPU:
 * SwiftShader, the software Vulkan implementation bundled with the browser.
 * `E2E_WEBGPU=hardware` drops them to measure on the machine's own GPU.
 */
export const webgpuArgs =
  process.env["E2E_WEBGPU"] === "hardware"
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
