import { test } from "@playwright/test";

import type { Harness } from "../src/harness/main";
import type { Op } from "../src/sim/script";
import { type Case, gpuMetrics, runReference } from "./gpu-reference";

declare global {
  interface Window {
    harness: Harness;
  }
}

const throwAt = (at: number, vx: number): Op => ({
  at,
  kind: "throw",
  x: 1,
  y: 1.2,
  vx,
  vy: 0,
});

for (let seed = 1; seed <= 8; seed++) {
  test(`measure seed ${String(seed)}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/harness.html");
    const c: Case = {
      scene: "wall",
      material: "steel",
      resolution: "standard",
      steps: 7500,
      ops: [throwAt(1500, 8)],
      seed,
    };
    const want = runReference(c).metrics;
    const got = gpuMetrics(
      c,
      await page.evaluate((config) => window.harness.run(config), c),
    );
    console.log(
      `MEASURE ${JSON.stringify({ seed, dEro: got.erodedFraction - want.erodedFraction, dChunks: got.chunks - want.chunks, dPlastic: got.maxPlasticStrain - want.maxPlasticStrain, dCom: Math.hypot(got.centreOfMass.x - want.centreOfMass.x, got.centreOfMass.y - want.centreOfMass.y), ero: want.erodedFraction })}`,
    );
  });
}

test("measure rest", async ({ page }) => {
  await page.goto("/harness.html");
  const c: Case = {
    scene: "wall",
    material: "steel",
    resolution: "standard",
    steps: 5000,
    ops: [throwAt(1500, 1)],
  };
  const want = runReference(c);
  const got = await page.evaluate((config) => window.harness.run(config), c);
  let pos = 0,
    vel = 0;
  for (let n = 0; n < want.x.length; n++) {
    pos = Math.max(
      pos,
      Math.abs((got.x[n] ?? 0) - (want.x[n] ?? 0)),
      Math.abs((got.y[n] ?? 0) - (want.y[n] ?? 0)),
    );
    vel = Math.max(
      vel,
      Math.abs((got.vx[n] ?? 0) - (want.vx[n] ?? 0)),
      Math.abs((got.vy[n] ?? 0) - (want.vy[n] ?? 0)),
    );
  }
  console.log(`MEASURE ${JSON.stringify({ rest: true, pos, vel })}`);
});

test("measure ring", async ({ page }) => {
  await page.goto("/harness.html");
  const ops: Op[] = Array.from({ length: 9 }, (_, i) => ({
    at: 100 * i,
    kind: "throw" as const,
    x: 0.5 + i,
    y: 3 + 0.2 * i,
    vx: 0.3 * i,
    vy: 0,
  }));
  const c: Case = {
    scene: "wall",
    material: "steel",
    resolution: "standard",
    steps: 3000,
    ops,
  };
  const want = runReference(c).balls;
  const got = (await page.evaluate((config) => window.harness.run(config), c))
    .balls;
  const byX = <T extends { x: number }>(b: T[]) =>
    [...b].sort((a, z) => a.x - z.x);
  let worst = 0;
  byX(got).forEach((ball, i) => {
    const ref = byX(want)[i];
    for (const key of ["x", "y", "vx", "vy"] as const)
      worst = Math.max(worst, Math.abs(ball[key] - (ref?.[key] ?? Number.NaN)));
  });
  console.log(`MEASURE ${JSON.stringify({ ring: true, worst })}`);
});
