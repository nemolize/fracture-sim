import { atByte, atF32, atU32 } from "@/sim/array";
import { labelChunks } from "@/sim/chunks";
import type { WorldStats } from "@/sim/stats";

import { RECORD_WORDS } from "./layout";

/** The per-triangle fields of an `ElemState` readback, one entry per triangle. */
export interface ElemFields {
  alive: Uint8Array;
  plasticStrain: Float32Array;
  damage: Float32Array;
  stressRatio: Float32Array;
}

export const unpackElemState = (
  buffer: ArrayBuffer,
  triCount: number,
): ElemFields => {
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  const fields: ElemFields = {
    alive: new Uint8Array(triCount),
    plasticStrain: new Float32Array(triCount),
    damage: new Float32Array(triCount),
    stressRatio: new Float32Array(triCount),
  };
  for (let e = 0; e < triCount; e++) {
    const base = RECORD_WORDS * e;
    fields.plasticStrain[e] = atF32(f32, base + 4);
    fields.damage[e] = atF32(f32, base + 5);
    fields.stressRatio[e] = atF32(f32, base + 6);
    fields.alive[e] = atU32(u32, base + 7);
  }
  return fields;
};

/**
 * Turns an `ElemState` readback into the statistics panel's numbers. Piece
 * labelling walks every triangle, so it reruns only when the eroded count has
 * changed since the last labelling.
 */
export class StatsTracker {
  private labelledErodedCount = -1;
  private chunkCount = 1;
  readonly chunkOf: Int32Array<ArrayBuffer>;
  private readonly tri: Int32Array;
  private readonly nodeCount: number;

  constructor(tri: Int32Array, nodeCount: number) {
    this.tri = tri;
    this.nodeCount = nodeCount;
    this.chunkOf = new Int32Array(tri.length / 3);
  }

  /** `relabelled` is true when `chunkOf` changed and needs uploading again. */
  update(buffer: ArrayBuffer): { stats: WorldStats; relabelled: boolean } {
    const triCount = this.chunkOf.length;
    const fields = unpackElemState(buffer, triCount);
    let eroded = 0;
    let maxPlasticStrain = 0;
    for (let e = 0; e < triCount; e++) {
      if (atByte(fields.alive, e) === 0) eroded++;
      maxPlasticStrain = Math.max(
        maxPlasticStrain,
        atF32(fields.plasticStrain, e),
      );
    }
    const relabelled = eroded !== this.labelledErodedCount;
    if (relabelled) {
      this.labelledErodedCount = eroded;
      this.chunkCount = labelChunks(
        this.tri,
        fields.alive,
        this.nodeCount,
        this.chunkOf,
      );
    }
    return {
      stats: {
        erodedFraction: eroded / triCount,
        chunks: this.chunkCount,
        maxPlasticStrain,
      },
      relabelled,
    };
  }
}
