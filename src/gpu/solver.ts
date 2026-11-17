import {
  AIR_DRAG,
  BLAST_RADIUS,
  BLAST_SPEED,
  makeBall,
  MAX_BALLS,
} from "@/sim/contact";
import { type MaterialName, MATERIALS } from "@/sim/materials";
import { type ResolutionName, RESOLUTIONS, timeStep } from "@/sim/resolution";
import { buildMesh, type SceneName, WORLD_WIDTH } from "@/sim/scenes";
import type { WorldStats } from "@/sim/stats";

import {
  dispatchCount,
  packBall,
  packMaterial,
  packMesh,
  RECORD_BYTES,
  unpackNodes,
} from "./layout";
import { encodeParams, PARAMS_BYTES, type SolverParams } from "./params";
import { SHADERS } from "./shaders";
import { type ElemFields, StatsTracker, unpackElemState } from "./stats";
import { BufferUsage, MapMode, ShaderStage } from "./usage";

export interface SolverOptions {
  scene: SceneName;
  material: MaterialName;
  resolution: ResolutionName;
  seed?: number;
}

/** Buffers the renderer reads; they stay owned by the solver. */
export interface SolverBuffers {
  nodes: GPUBuffer;
  elemStatic: GPUBuffer;
  elemState: GPUBuffer;
  chunkOf: GPUBuffer;
  balls: GPUBuffer;
}

/** The solver's whole state read back to the CPU, for tests. */
export interface Snapshot extends ElemFields {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  nodeRefs: Uint32Array;
  chunkOf: Int32Array;
  /** `x, y, vx, vy, radius, mass` per active ball. */
  balls: number[][];
  time: number;
}

interface Binding {
  buffer: GPUBuffer;
  type: GPUBufferBindingType;
}

interface Pass {
  pipeline: GPUComputePipeline;
  group: GPUBindGroup;
}

/**
 * The solver on WebGPU: three compute passes per step (triangle forces, node
 * update, balls), the same algorithm as the CPU `World` in f32. Its state
 * never leaves the GPU except for the statistics read-back.
 */
export class GpuSolver {
  readonly dt: number;
  readonly nodeCount: number;
  readonly triCount: number;
  readonly buffers: SolverBuffers;
  time = 0;

  private readonly device: GPUDevice;
  private readonly params: SolverParams;
  private readonly paramsBuffer: GPUBuffer;
  private readonly owned: GPUBuffer[] = [];
  private readonly elements: Pass;
  private readonly nodePass: Pass;
  private readonly ballPass: Pass;
  private readonly grabPass: Pass;
  private readonly blastPass: Pass;
  private readonly tracker: StatsTracker;
  private thrown = 0;
  private readPending = false;

  constructor(
    device: GPUDevice,
    { scene, material, resolution, seed = 1 }: SolverOptions,
  ) {
    this.device = device;
    const { cell } = RESOLUTIONS[resolution];
    this.dt = timeStep(cell);
    const mesh = buildMesh(scene, seed, cell);
    const packed = packMesh(mesh);
    this.nodeCount = packed.nodeCount;
    this.triCount = packed.triCount;
    this.tracker = new StatsTracker(packed.tri, packed.nodeCount);

    const storage = (data: BufferSource | number, extra = 0): GPUBuffer => {
      const size = typeof data === "number" ? data : data.byteLength;
      const buffer = this.device.createBuffer({
        size: Math.max(size, 16),
        usage:
          BufferUsage.STORAGE |
          BufferUsage.COPY_DST |
          BufferUsage.COPY_SRC |
          extra,
      });
      if (typeof data !== "number")
        this.device.queue.writeBuffer(buffer, 0, data);
      this.owned.push(buffer);
      return buffer;
    };
    const uniform = (data: BufferSource | number): GPUBuffer => {
      const size = typeof data === "number" ? data : data.byteLength;
      const buffer = this.device.createBuffer({
        size,
        usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
      });
      if (typeof data !== "number")
        this.device.queue.writeBuffer(buffer, 0, data);
      this.owned.push(buffer);
      return buffer;
    };

    const nodes = storage(packed.nodes);
    const elemStatic = storage(packed.elemStatic);
    const elemState = storage(packed.elemState);
    const adjacency = storage(packed.adjacency);
    const elemForce = storage(16 * this.triCount);
    const balls = storage(MAX_BALLS * RECORD_BYTES);
    const ballPush = storage(8 * MAX_BALLS * this.nodeCount);
    const chunkOf = storage(this.tracker.chunkOf);
    this.paramsBuffer = uniform(PARAMS_BYTES);
    const materialBuffer = uniform(packMaterial(MATERIALS[material]));
    this.buffers = { nodes, elemStatic, elemState, chunkOf, balls };

    this.params = {
      dt: this.dt,
      drag: Math.exp(-AIR_DRAG * this.dt),
      width: WORLD_WIDTH,
      ballCount: 0,
      nodeCount: this.nodeCount,
      triCount: this.triCount,
      grabActive: false,
      blastRadius: BLAST_RADIUS,
      grabTarget: { x: 0, y: 0 },
      blastCenter: { x: 0, y: 0 },
      blastSpeed: BLAST_SPEED,
    };
    this.writeParams();

    const read = "read-only-storage";
    const write = "storage";
    const p: Binding = { buffer: this.paramsBuffer, type: "uniform" };
    this.elements = this.pass(SHADERS.elements, "elementForces", [
      p,
      { buffer: materialBuffer, type: "uniform" },
      { buffer: nodes, type: read },
      { buffer: elemStatic, type: read },
      { buffer: elemState, type: write },
      { buffer: elemForce, type: write },
    ]);
    this.nodePass = this.pass(SHADERS.nodes, "nodeStep", [
      p,
      { buffer: materialBuffer, type: "uniform" },
      { buffer: nodes, type: write },
      { buffer: elemStatic, type: read },
      { buffer: elemState, type: read },
      { buffer: elemForce, type: read },
      { buffer: adjacency, type: read },
      { buffer: balls, type: read },
      { buffer: ballPush, type: write },
    ]);
    this.ballPass = this.pass(SHADERS.balls, "ballStep", [
      p,
      { buffer: ballPush, type: read },
      { buffer: balls, type: write },
    ]);
    const interact: Binding[] = [p, { buffer: nodes, type: write }];
    this.grabPass = this.pass(SHADERS.interact, "grabStart", interact);
    this.blastPass = this.pass(SHADERS.interact, "blast", interact);
  }

  /** Advances the simulation by `count` fixed steps in one submission. */
  step(count: number): void {
    if (count <= 0) return;
    const encoder = this.device.createCommandEncoder();
    const compute = encoder.beginComputePass();
    const triGroups = dispatchCount(this.triCount);
    const nodeGroups = dispatchCount(this.nodeCount);
    for (let s = 0; s < count; s++) {
      this.dispatch(compute, this.elements, triGroups);
      this.dispatch(compute, this.nodePass, nodeGroups);
      if (this.params.ballCount > 0) {
        this.dispatch(compute, this.ballPass, this.params.ballCount);
      }
    }
    compute.end();
    this.device.queue.submit([encoder.finish()]);
    this.time += count * this.dt;
  }

  /** Adds a ball, dropping the oldest once there are too many. */
  throwBall(x: number, y: number, vx: number, vy: number): void {
    const slot = this.thrown % MAX_BALLS;
    this.thrown++;
    this.device.queue.writeBuffer(
      this.buffers.balls,
      slot * RECORD_BYTES,
      packBall(makeBall(x, y, vx, vy)),
    );
    this.params.ballCount = Math.min(this.thrown, MAX_BALLS);
    this.writeParams();
  }

  blast(x: number, y: number): void {
    this.params.blastCenter = { x, y };
    this.writeParams();
    this.runOnce(this.blastPass);
  }

  startGrab(x: number, y: number): void {
    this.params.grabTarget = { x, y };
    this.params.grabActive = true;
    this.writeParams();
    this.runOnce(this.grabPass);
  }

  moveGrab(x: number, y: number): void {
    if (!this.params.grabActive) return;
    this.params.grabTarget = { x, y };
    this.writeParams();
  }

  endGrab(): void {
    this.params.grabActive = false;
    this.writeParams();
  }

  get grabbing(): boolean {
    return this.params.grabActive;
  }

  /** Statistics for the panel, or null when the read-back is still pending or failed. */
  async readStats(): Promise<WorldStats | null> {
    if (this.readPending) return null;
    this.readPending = true;
    try {
      const bytes = await this.readBuffer(
        this.buffers.elemState,
        RECORD_BYTES * this.triCount,
      );
      if (bytes === null) return null;
      const { stats, relabelled } = this.tracker.update(bytes);
      if (relabelled) {
        this.device.queue.writeBuffer(
          this.buffers.chunkOf,
          0,
          this.tracker.chunkOf,
        );
      }
      return stats;
    } finally {
      this.readPending = false;
    }
  }

  /** Reads the whole state back; slow, meant for tests. */
  async snapshot(): Promise<Snapshot> {
    const [nodeBytes, elemBytes, ballBytes] = await Promise.all([
      this.readBuffer(this.buffers.nodes, RECORD_BYTES * this.nodeCount),
      this.readBuffer(this.buffers.elemState, RECORD_BYTES * this.triCount),
      this.readBuffer(this.buffers.balls, RECORD_BYTES * MAX_BALLS),
    ]);
    if (nodeBytes === null || elemBytes === null || ballBytes === null) {
      throw new Error("state read-back failed");
    }
    this.tracker.update(elemBytes);
    const floats = new Float32Array(ballBytes);
    const balls: number[][] = [];
    for (let b = 0; b < this.params.ballCount; b++) {
      balls.push(Array.from(floats.slice(8 * b, 8 * b + 6)));
    }
    return {
      ...unpackNodes(nodeBytes, this.nodeCount),
      ...unpackElemState(elemBytes, this.triCount),
      chunkOf: this.tracker.chunkOf.slice(),
      balls,
      time: this.time,
    };
  }

  /** Resolves once every submitted command has finished. */
  idle(): Promise<void> {
    return this.device.queue.onSubmittedWorkDone();
  }

  dispose(): void {
    for (const buffer of this.owned) buffer.destroy();
  }

  private writeParams(): void {
    this.device.queue.writeBuffer(
      this.paramsBuffer,
      0,
      encodeParams(this.params),
    );
  }

  private pass(code: string, entryPoint: string, bindings: Binding[]): Pass {
    const layout = this.device.createBindGroupLayout({
      entries: bindings.map(({ type }, binding) => ({
        binding,
        visibility: ShaderStage.COMPUTE,
        buffer: { type },
      })),
    });
    const pipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      compute: {
        module: this.device.createShaderModule({ code }),
        entryPoint,
      },
    });
    const group = this.device.createBindGroup({
      layout,
      entries: bindings.map(({ buffer }, binding) => ({
        binding,
        resource: { buffer },
      })),
    });
    return { pipeline, group };
  }

  private dispatch(
    compute: GPUComputePassEncoder,
    { pipeline, group }: Pass,
    groups: number,
  ): void {
    compute.setPipeline(pipeline);
    compute.setBindGroup(0, group);
    compute.dispatchWorkgroups(groups);
  }

  private runOnce(pass: Pass): void {
    const encoder = this.device.createCommandEncoder();
    const compute = encoder.beginComputePass();
    this.dispatch(compute, pass, dispatchCount(this.nodeCount));
    compute.end();
    this.device.queue.submit([encoder.finish()]);
  }

  /** Copies `size` bytes of `source` to the CPU; null when the map is aborted, e.g. by device loss. */
  private async readBuffer(
    source: GPUBuffer,
    size: number,
  ): Promise<ArrayBuffer | null> {
    const staging = this.device.createBuffer({
      size,
      usage: BufferUsage.MAP_READ | BufferUsage.COPY_DST,
    });
    try {
      const encoder = this.device.createCommandEncoder();
      encoder.copyBufferToBuffer(source, 0, staging, 0, size);
      this.device.queue.submit([encoder.finish()]);
      await staging.mapAsync(MapMode.READ);
      const copy = staging.getMappedRange().slice(0);
      staging.unmap();
      return copy;
    } catch (error) {
      if (error instanceof DOMException) return null;
      throw error;
    } finally {
      staging.destroy();
    }
  }
}
