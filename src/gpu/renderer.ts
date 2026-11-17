import { MAX_BALLS } from "@/sim/contact";
import { type MaterialName, MATERIALS } from "@/sim/materials";
import type { ViewMode } from "@/sim/view";

import {
  type Aim,
  BACKGROUND,
  packShapes,
  packView,
  SHAPES_BYTES,
  VIEW_BYTES,
} from "./frame";
import { SHADERS } from "./shaders";
import type { SolverBuffers } from "./solver";
import { BufferUsage, ShaderStage } from "./usage";

/** Draws the solver's state with one render pass: floor, body, balls, aim line. */
export class Renderer {
  private readonly device: GPUDevice;
  private readonly triCount: number;
  private readonly viewBuffer: GPUBuffer;
  private readonly shapesBuffer: GPUBuffer;
  private readonly group: GPUBindGroup;
  private readonly body: GPURenderPipeline;
  private readonly balls: GPURenderPipeline;
  private readonly shapes: GPURenderPipeline;
  private readonly baseColor: readonly [number, number, number];

  constructor(
    device: GPUDevice,
    buffers: SolverBuffers,
    material: MaterialName,
    format: GPUTextureFormat,
    triCount: number,
  ) {
    this.device = device;
    this.triCount = triCount;
    this.baseColor = MATERIALS[material].color;
    this.viewBuffer = device.createBuffer({
      size: VIEW_BYTES,
      usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
    });
    this.shapesBuffer = device.createBuffer({
      size: SHAPES_BYTES,
      usage: BufferUsage.STORAGE | BufferUsage.COPY_DST,
    });

    const visibility = ShaderStage.VERTEX | ShaderStage.FRAGMENT;
    const sources = [
      this.viewBuffer,
      buffers.nodes,
      buffers.elemStatic,
      buffers.elemState,
      buffers.chunkOf,
      buffers.balls,
      this.shapesBuffer,
    ];
    const layout = device.createBindGroupLayout({
      entries: sources.map((_, binding) => ({
        binding,
        visibility,
        buffer: { type: binding === 0 ? "uniform" : "read-only-storage" },
      })),
    });
    this.group = device.createBindGroup({
      layout,
      entries: sources.map((buffer, binding) => ({
        binding,
        resource: { buffer },
      })),
    });
    const module = device.createShaderModule({ code: SHADERS.render });
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [layout],
    });
    const pipeline = (vertex: string, fragment: string): GPURenderPipeline =>
      device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: { module, entryPoint: vertex },
        fragment: { module, entryPoint: fragment, targets: [{ format }] },
        primitive: { topology: "triangle-list" },
      });
    this.body = pipeline("bodyVertex", "flatFragment");
    this.balls = pipeline("ballVertex", "discFragment");
    this.shapes = pipeline("shapeVertex", "flatFragment");
  }

  draw(
    target: GPUTextureView,
    pixelWidth: number,
    pixelHeight: number,
    view: ViewMode,
    aim: Aim | null,
  ): void {
    const { queue } = this.device;
    queue.writeBuffer(
      this.viewBuffer,
      0,
      packView(pixelWidth, pixelHeight, view, this.baseColor),
    );
    queue.writeBuffer(
      this.shapesBuffer,
      0,
      packShapes(pixelWidth, pixelHeight, aim),
    );

    const [r, g, b] = BACKGROUND;
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: target,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: r / 255, g: g / 255, b: b / 255, a: 1 },
        },
      ],
    });
    pass.setBindGroup(0, this.group);
    pass.setPipeline(this.shapes);
    pass.draw(6, 1, 0, 0);
    pass.setPipeline(this.body);
    pass.draw(3 * this.triCount);
    pass.setPipeline(this.balls);
    pass.draw(6, MAX_BALLS);
    pass.setPipeline(this.shapes);
    pass.draw(6, 1, 0, 1);
    pass.end();
    queue.submit([encoder.finish()]);
  }

  dispose(): void {
    this.viewBuffer.destroy();
    this.shapesBuffer.destroy();
  }
}
