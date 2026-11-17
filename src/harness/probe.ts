import { ADAPTER_OPTIONS, gpuContext } from "@/gpu/device";
import { BufferUsage, MapMode, ShaderStage, TextureUsage } from "@/gpu/usage";

import { readTexture } from "./readback";

export interface ProbeResult {
  adapter: {
    vendor: string;
    architecture: string;
    description: string;
    isFallback: boolean;
  } | null;
  /** `in[i] * 2 + 1` for `in = 0..7`, computed by a compute shader. */
  computeOutput: number[];
  /** RGBA at the centre of a render-pipeline triangle drawn into a texture. */
  triangleCentre: number[];
  /** RGBA at the centre of the same triangle read back from a canvas. */
  canvasCentre: number[];
}

const COMPUTE = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;
@compute @workgroup_size(8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  data[gid.x] = data[gid.x] * 2.0 + 1.0;
}`;

const TRIANGLE = /* wgsl */ `
@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  var p = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  return vec4<f32>(p[i], 0.0, 1.0);
}
@fragment
fn fs() -> @location(0) vec4<f32> { return vec4<f32>(1.0, 0.0, 0.0, 1.0); }`;

const SIZE = 16;

const computeProbe = async (device: GPUDevice): Promise<number[]> => {
  const input = Float32Array.from({ length: 8 }, (_, i) => i);
  const storage = device.createBuffer({
    size: input.byteLength,
    usage: BufferUsage.STORAGE | BufferUsage.COPY_SRC | BufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(storage, 0, input);
  const staging = device.createBuffer({
    size: input.byteLength,
    usage: BufferUsage.MAP_READ | BufferUsage.COPY_DST,
  });
  const layout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: ShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ],
  });
  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    compute: {
      module: device.createShaderModule({ code: COMPUTE }),
      entryPoint: "main",
    },
  });
  const group = device.createBindGroup({
    layout,
    entries: [{ binding: 0, resource: { buffer: storage } }],
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, group);
  pass.dispatchWorkgroups(1);
  pass.end();
  encoder.copyBufferToBuffer(storage, 0, staging, 0, input.byteLength);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(MapMode.READ);
  const output = Array.from(new Float32Array(staging.getMappedRange()));
  staging.unmap();
  return output;
};

const drawTriangle = (
  device: GPUDevice,
  target: GPUTextureView,
  format: GPUTextureFormat,
): void => {
  const module = device.createShaderModule({ code: TRIANGLE });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: { module, entryPoint: "fs", targets: [{ format }] },
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: target,
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.draw(3);
  pass.end();
  device.queue.submit([encoder.finish()]);
};

const centre = (pixels: Uint8Array): number[] => {
  const at = 4 * (SIZE / 2 + (SIZE / 2) * SIZE);
  return Array.from(pixels.subarray(at, at + 4));
};

/** Exercises what the app needs from the environment, independent of the solver. */
export const probe = async (): Promise<ProbeResult> => {
  const adapter = await navigator.gpu.requestAdapter(ADAPTER_OPTIONS);
  if (adapter === null) {
    return {
      adapter: null,
      computeOutput: [],
      triangleCentre: [],
      canvasCentre: [],
    };
  }
  const device = await adapter.requestDevice();

  const texture = device.createTexture({
    size: { width: SIZE, height: SIZE },
    format: "rgba8unorm",
    usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC,
  });
  drawTriangle(device, texture.createView(), "rgba8unorm");
  const triangleCentre = centre(await readTexture(device, texture, SIZE, SIZE));

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = gpuContext(canvas);
  if (context === null) throw new Error("no webgpu canvas context");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC,
    alphaMode: "opaque",
  });
  const canvasTexture = context.getCurrentTexture();
  drawTriangle(device, canvasTexture.createView(), format);
  const canvasPixels = await readTexture(device, canvasTexture, SIZE, SIZE);
  // bgra8unorm reads back blue first; report RGBA either way.
  const [b0 = 0, g = 0, r0 = 0, a = 0] = centre(canvasPixels);
  const canvasCentre =
    format === "bgra8unorm" ? [r0, g, b0, a] : centre(canvasPixels);

  const computeOutput = await computeProbe(device);
  // Read last, so the adapter stays referenced until every read-back is done.
  const { vendor, architecture, description, isFallbackAdapter } = adapter.info;
  return {
    adapter: {
      vendor,
      architecture,
      description,
      isFallback: isFallbackAdapter,
    },
    computeOutput,
    triangleCentre,
    canvasCentre,
  };
};
