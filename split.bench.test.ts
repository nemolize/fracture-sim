import { performance } from "node:perf_hooks";
import process from "node:process";

import { expect, it } from "vitest";

import { splitConvex } from "./src/sim/split";
import { percentile, runsOnShared } from "./src/sim/timing";

const ROUNDS = 5;

it.skipIf(runsOnShared(process.env))(
  "splits 32 seeds in under 0.5 ms (best p95 of 5 rounds of 1,000, coverage off)",
  () => {
    const ring = Array.from({ length: 8 }, (_, i) => ({
      x: 3 * Math.cos((2 * Math.PI * i) / 8),
      y: 3 * Math.sin((2 * Math.PI * i) / 8),
    }));
    const inputs = Array.from({ length: 1000 }, (_, j) =>
      Array.from({ length: 32 }, (_, i) => ({
        x: ((i % 8) - 3.5) * 0.35 + Math.sin(i + j) * 0.05,
        y: (Math.floor(i / 8) - 1.5) * 0.35 + Math.cos(i - j) * 0.05,
      })),
    );
    for (const seeds of inputs.slice(0, 100)) splitConvex(ring, seeds);
    const rounds = Array.from({ length: ROUNDS }, () => {
      const times = inputs.map((seeds) => {
        const start = performance.now();
        splitConvex(ring, seeds);
        return performance.now() - start;
      });
      return percentile(times, 0.95);
    });
    const bestRoundP95 = Math.min(...rounds);
    console.info(
      JSON.stringify({
        samples: inputs.length,
        rounds: ROUNDS,
        roundP95Ms: rounds,
        p95Ms: bestRoundP95,
        runtime: process.version,
      }),
    );
    expect(bestRoundP95).toBeLessThan(0.5);
  },
);
