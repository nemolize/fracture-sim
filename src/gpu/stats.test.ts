import { describe, expect, it } from "vitest";

import { RECORD_WORDS } from "./layout";
import { StatsTracker, unpackElemState } from "./stats";

// Two triangles sharing node 1, one separate triangle, and one eroded one.
const tri = Int32Array.of(0, 1, 2, 1, 3, 2, 4, 5, 6, 0, 2, 3);

const elemState = (alive: number[], plastic: number[]): ArrayBuffer => {
  const words = new ArrayBuffer(4 * RECORD_WORDS * alive.length);
  const f32 = new Float32Array(words);
  const u32 = new Uint32Array(words);
  alive.forEach((flag, e) => {
    f32[RECORD_WORDS * e + 4] = plastic[e] ?? 0;
    f32[RECORD_WORDS * e + 5] = 0.5;
    f32[RECORD_WORDS * e + 6] = 2;
    u32[RECORD_WORDS * e + 7] = flag;
  });
  return words;
};

describe("unpackElemState", () => {
  it("splits the records into per-triangle arrays", () => {
    const fields = unpackElemState(elemState([1, 0], [0.25, 0.75]), 2);
    expect(Array.from(fields.alive)).toEqual([1, 0]);
    expect(Array.from(fields.plasticStrain)).toEqual([0.25, 0.75]);
    expect(Array.from(fields.damage)).toEqual([0.5, 0.5]);
    expect(Array.from(fields.stressRatio)).toEqual([2, 2]);
  });
});

describe("StatsTracker", () => {
  it("reports the eroded fraction, the pieces and the largest plastic strain", () => {
    const tracker = new StatsTracker(tri, 7);
    const { stats, relabelled } = tracker.update(
      elemState([1, 1, 1, 0], [0, 0.5, 0.25, 0.75]),
    );
    expect(stats).toEqual({
      erodedFraction: 0.25,
      chunks: 2,
      maxPlasticStrain: 0.75,
    });
    expect(relabelled).toBe(true);
    expect(Array.from(tracker.chunkOf)[3]).toBe(-1);
  });

  it("relabels only when the eroded count changed", () => {
    const tracker = new StatsTracker(tri, 7);
    tracker.update(elemState([1, 1, 1, 1], [0, 0, 0, 0]));
    expect(
      tracker.update(elemState([1, 1, 1, 1], [0, 0, 0, 0])).relabelled,
    ).toBe(false);
    const next = tracker.update(elemState([1, 0, 1, 1], [0, 0, 0, 0]));
    expect(next.relabelled).toBe(true);
    expect(next.stats.erodedFraction).toBe(0.25);
  });

  it("keeps the last piece count while nothing new has eroded", () => {
    const tracker = new StatsTracker(tri, 7);
    const first = tracker.update(elemState([1, 1, 1, 0], [0, 0, 0, 0]));
    const again = tracker.update(elemState([1, 1, 1, 0], [0, 0, 0, 0]));
    expect(again.stats.chunks).toBe(first.stats.chunks);
  });
});
