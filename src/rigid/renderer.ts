import { floorMargin, visibleWorldHeight } from "@/gpu/camera";
import { BufferUsage } from "@/gpu/usage";

import { DEFAULT_ENVIRONMENT, type EnvironmentSettings } from "./environment";

const shader = (bounds: Pick<EnvironmentSettings, "width">) => `
struct Vertex { @builtin(position) position: vec4f, @location(0) color: vec3f };
@group(0) @binding(0) var<storage, read> poses: array<vec4f>;
@group(0) @binding(1) var<uniform> view: vec4f;
@vertex fn vertex(@location(0) point: vec2f, @location(1) body: f32, @location(2) color: vec3f) -> Vertex {
  let pose = poses[u32(body)];
  let p = pose.xy + vec2f(pose.z * point.x - pose.w * point.y, pose.w * point.x + pose.z * point.y);
  return Vertex(vec4f(p.x / ${bounds.width.toFixed(6)} * 2.0 - 1.0, (p.y + ${String(floorMargin(bounds.width))}) / (view.y + ${String(floorMargin(bounds.width))}) * 2.0 - 1.0, 0.0, 1.0), color);
}
@fragment fn fragment(input: Vertex) -> @location(0) vec4f { return vec4f(input.color, 1.0); }
`;

export class RigidRenderer {
  private readonly device: GPUDevice;
  private readonly vertices: GPUBuffer;
  private readonly poses: GPUBuffer;
  private readonly view: GPUBuffer;
  private readonly group: GPUBindGroup;
  private readonly pipeline: GPURenderPipeline;
  private readonly count: number;
  private readonly bounds: Pick<EnvironmentSettings, "width">;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    vertices: Float32Array<ArrayBuffer>,
    poses: Float32Array<ArrayBuffer>,
    bounds: Pick<EnvironmentSettings, "width"> = DEFAULT_ENVIRONMENT,
  ) {
    this.device = device;
    this.count = vertices.length / 6;
    this.bounds = bounds;
    this.vertices = device.createBuffer({
      size: vertices.byteLength,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });
    this.view = device.createBuffer({
      size: 16,
      usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
    });
    this.poses = device.createBuffer({
      size: poses.byteLength,
      usage: BufferUsage.STORAGE | BufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertices, 0, vertices);
    device.queue.writeBuffer(this.poses, 0, poses);
    const module = device.createShaderModule({ code: shader(bounds) });
    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vertex",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32" },
              { shaderLocation: 2, offset: 12, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: { module, entryPoint: "fragment", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
    this.group = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.poses } },
        { binding: 1, resource: { buffer: this.view } },
      ],
    });
  }

  draw(
    target: GPUTextureView,
    poses: Float32Array<ArrayBuffer>,
    canvas: { width: number; height: number },
  ): void {
    this.device.queue.writeBuffer(this.poses, 0, poses);
    this.device.queue.writeBuffer(
      this.view,
      0,
      new Float32Array([
        0,
        visibleWorldHeight(canvas.width, canvas.height, this.bounds.width),
        0,
        0,
      ]),
    );
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: target,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 243 / 255, g: 244 / 255, b: 246 / 255, a: 1 },
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.group);
    pass.setVertexBuffer(0, this.vertices);
    pass.draw(this.count);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  dispose(): void {
    this.vertices.destroy();
    this.poses.destroy();
    this.view.destroy();
  }
}
