import { expect, test } from "@playwright/test";

import type { Harness } from "../src/harness/main";
import { MATERIAL_NAMES, MATERIALS } from "../src/sim/materials";
import { RESOLUTION_NAMES, RESOLUTIONS } from "../src/sim/resolution";
import { SCENE_NAMES } from "../src/sim/scenes";
import type { Op } from "../src/sim/script";
import { VIEW_MODES } from "../src/sim/view";
import { World } from "../src/sim/world";
import { type Case, gpuMetrics, runReference } from "./gpu-reference";

declare global {
  interface Window {
    harness: Harness;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/harness.html");
});

const throwAt = (at: number, vx: number): Op => ({
  at,
  kind: "throw",
  x: 1,
  y: 1.2,
  vx,
  vy: 0,
});

test("should have a WebGPU adapter that can compute and render", async ({
  page,
}) => {
  const result = await page.evaluate(() => window.harness.probe());

  expect(result.adapter).not.toBeNull();
  test.info().annotations.push({
    type: "adapter",
    description: JSON.stringify(result.adapter),
  });
  // f32 compute readback: in[i] * 2 + 1 for in = 0..7.
  expect(result.computeOutput).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
  // A render-pipeline triangle covers the centre of the target, in a texture and on a canvas.
  expect(result.triangleCentre).toEqual([255, 0, 0, 255]);
  expect(result.canvasCentre).toEqual([255, 0, 0, 255]);
});

// Limits are the worst f32-vs-f64 error measured over mesh seeds 1-8, rounded up.
const REST_POSITION = { atol: 1e-4, rtol: 1e-5 };
const REST_VELOCITY = { atol: 1e-2, rtol: 1e-2 };
const FRACTURE = {
  erodedFraction: 0.02,
  chunks: 2,
  maxPlasticStrain: 0.05,
  centreOfMass: 0.1,
};

const withinTolerance = (
  got: number[],
  want: number[],
  { atol, rtol }: { atol: number; rtol: number },
): { index: number; got: number; want: number } | null => {
  for (let i = 0; i < want.length; i++) {
    const reference = want[i] ?? 0;
    const value = got[i] ?? Number.NaN;
    if (!(Math.abs(value - reference) <= atol + rtol * Math.abs(reference))) {
      return { index: i, got: value, want: reference };
    }
  }
  return null;
};

test.describe("GPU solver against the CPU reference", () => {
  test.setTimeout(120_000);

  test("should match positions and velocities when nothing fractures", async ({
    page,
  }) => {
    const c: Case = {
      scene: "wall",
      material: "steel",
      resolution: "standard",
      steps: 5000,
      ops: [throwAt(1500, 1)],
    };
    const want = runReference(c);
    const got = await page.evaluate((config) => window.harness.run(config), c);

    expect(want.metrics.erodedFraction).toBe(0);
    expect(gpuMetrics(c, got).erodedFraction).toBe(0);
    expect(withinTolerance(got.x, want.x, REST_POSITION)).toBeNull();
    expect(withinTolerance(got.y, want.y, REST_POSITION)).toBeNull();
    expect(withinTolerance(got.vx, want.vx, REST_VELOCITY)).toBeNull();
    expect(withinTolerance(got.vy, want.vy, REST_VELOCITY)).toBeNull();
    expect(got.balls).toHaveLength(1);
    expect(got.balls[0]?.x).toBeCloseTo(want.balls[0]?.x ?? Number.NaN, 3);
  });

  test("should match the balls after the eight-slot ring wraps", async ({
    page,
  }) => {
    // Nine balls dropped from different heights and x positions; the oldest is replaced.
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
    // The GPU keeps balls in ring-slot order and the reference oldest first.
    const byX = <T extends { x: number }>(balls: T[]) =>
      [...balls].sort((a, b) => a.x - b.x);

    expect(want).toHaveLength(8);
    expect(got).toHaveLength(8);
    byX(got).forEach((ball, i) => {
      const ref = byX(want)[i];
      // Bouncing amplifies f32 rounding; the worst difference measured was 0.007.
      for (const key of ["x", "y", "vx", "vy"] as const) {
        expect(Math.abs(ball[key] - (ref?.[key] ?? Number.NaN))).toBeLessThan(
          0.02,
        );
      }
    });
  });

  for (const [name, c] of Object.entries({
    blast: {
      scene: "tower" as const,
      material: "steel" as const,
      resolution: "standard" as const,
      steps: 5000,
      ops: [{ at: 1500, kind: "blast" as const, x: 4.2, y: 1.5 }],
    },
    pull: {
      scene: "wall" as const,
      material: "steel" as const,
      resolution: "standard" as const,
      steps: 5000,
      ops: [
        { at: 500, kind: "grab" as const, x: 5, y: 1 },
        { at: 600, kind: "move" as const, x: 5, y: 1.3 },
        { at: 2500, kind: "release" as const },
      ],
    },
  } satisfies Record<string, Case>)) {
    test(`should match the ${name} tool against the reference`, async ({
      page,
    }) => {
      const want = runReference(c);
      const got = await page.evaluate(
        (config) => window.harness.run(config),
        c,
      );

      expect(withinTolerance(got.x, want.x, REST_POSITION)).toBeNull();
      expect(withinTolerance(got.y, want.y, REST_POSITION)).toBeNull();
      expect(withinTolerance(got.vx, want.vx, REST_VELOCITY)).toBeNull();
      expect(withinTolerance(got.vy, want.vy, REST_VELOCITY)).toBeNull();
      // The tool must have moved something, or the comparison proves nothing.
      expect(
        Math.max(...want.vx.map(Math.abs), ...want.vy.map(Math.abs)),
      ).toBeGreaterThan(0.1);
    });
  }

  for (const seed of [1, 2, 3, 4]) {
    test(`should agree on how the wall breaks (mesh seed ${String(seed)})`, async ({
      page,
    }) => {
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

      expect(want.erodedFraction).toBeGreaterThan(0.1);
      expect(
        Math.abs(got.erodedFraction - want.erodedFraction),
      ).toBeLessThanOrEqual(FRACTURE.erodedFraction);
      expect(Math.abs(got.chunks - want.chunks)).toBeLessThanOrEqual(
        FRACTURE.chunks,
      );
      expect(
        Math.abs(got.maxPlasticStrain - want.maxPlasticStrain),
      ).toBeLessThanOrEqual(FRACTURE.maxPlasticStrain);
      expect(
        Math.hypot(
          got.centreOfMass.x - want.centreOfMass.x,
          got.centreOfMass.y - want.centreOfMass.y,
        ),
      ).toBeLessThanOrEqual(FRACTURE.centreOfMass);
    });
  }
});

test.describe("rendering", () => {
  // World points: inside the wall, open sky, on the floor, at the ball, on the aim line.
  const samples: [number, number][] = [
    [5, 1],
    [1, 4.5],
    [5, -0.2],
    [1, 3],
    [1.5, 4],
  ];
  const BACKGROUND = [243, 244, 246];
  const FLOOR = [209, 213, 219];
  const BALL = [31, 41, 55];
  const AIM = [220, 38, 38];
  const [r, g, b] = MATERIALS.concrete.color;
  // A fresh body has no damage, plastic strain or stress; piece 0 has hue 0.
  const BODY: Record<string, number[]> = {
    material: [r, g, b],
    damage: [0, 0, 160],
    plastic: [0, 0, 160],
    stress: [0, 0, 160],
    chunks: [209, 97, 97],
  };

  for (const view of VIEW_MODES) {
    test(`should draw body, ball, aim line and floor in the ${view} view`, async ({
      page,
    }) => {
      const result = await page.evaluate(
        (config) => window.harness.render(config),
        {
          scene: "wall" as const,
          material: "concrete" as const,
          resolution: "standard" as const,
          steps: 0,
          ops: [
            { at: 0, kind: "throw" as const, x: 1, y: 3, vx: 0, vy: 0 },
          ] satisfies Op[],
          view,
          aim: { x0: 1, y0: 4, x1: 2, y1: 4 },
          samples,
        },
      );
      const [body, sky, floor, ball, aim] = result.samples;
      const close = (pixel: number[] | undefined, want: number[]) =>
        want.every(
          (channel, i) => Math.abs((pixel?.[i] ?? -99) - channel) <= 2,
        );

      expect(close(body, BODY[view] ?? [])).toBe(true);
      expect(close(body, BACKGROUND)).toBe(false);
      expect(close(sky, BACKGROUND)).toBe(true);
      expect(close(floor, FLOOR)).toBe(true);
      expect(close(ball, BALL)).toBe(true);
      expect(close(aim, AIM)).toBe(true);
    });
  }
});

test.describe("mesh resolution", () => {
  test("should offer at least three levels, the finest with 10x the triangles", () => {
    expect(RESOLUTION_NAMES.length).toBeGreaterThanOrEqual(3);
    expect(RESOLUTIONS.standard.cell).toBe(0.1);
    const triangles = (cell: number, scene: "wall" | "tower") =>
      new World({ scene, material: "glass", cell }).triCount;
    for (const scene of SCENE_NAMES) {
      expect(
        triangles(RESOLUTIONS.finest.cell, scene) /
          triangles(RESOLUTIONS.standard.cell, scene),
      ).toBeGreaterThanOrEqual(10);
    }
  });

  // Worst loading the tools can apply at once: the fastest ball, a blast and a pull.
  const stress: Op[] = [
    { at: 0, kind: "throw", x: 1, y: 2, vx: 25, vy: 0 },
    { at: 200, kind: "blast", x: 5, y: 1 },
    { at: 400, kind: "grab", x: 5, y: 1 },
    { at: 500, kind: "move", x: 5, y: 3 },
    { at: 2000, kind: "release" },
  ];

  for (const resolution of RESOLUTION_NAMES) {
    for (const scene of SCENE_NAMES) {
      for (const material of MATERIAL_NAMES) {
        test(`should stay finite for 10 s: ${scene}, ${material}, ${resolution}`, async ({
          page,
        }) => {
          test.setTimeout(600_000);
          const result = await page.evaluate(
            (config) => window.harness.sweep(config),
            { scene, material, resolution, seconds: 10, ops: stress },
          );

          expect(result.allFinite).toBe(true);
          expect(result.steps * result.dt).toBeGreaterThanOrEqual(10);
        });
      }
    }
  }
});

test.describe("speed", () => {
  test("should run the finest mesh at least as fast as the CPU reference, at default speed", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const probe = await page.evaluate(() => window.harness.probe());
    test.skip(probe.adapter?.isFallback !== false, "needs a physical GPU");
    const adapter = JSON.stringify(probe.adapter);
    test.info().annotations.push({ type: "adapter", description: adapter });

    const config = {
      scene: "wall" as const,
      material: "concrete" as const,
      resolution: "finest" as const,
    };
    const gpu = await page.evaluate(
      (options) => window.harness.measureSteps(options),
      { ...config, milliseconds: 3000 },
    );
    const world = new World({
      scene: config.scene,
      material: config.material,
      cell: RESOLUTIONS.finest.cell,
    });
    const start = performance.now();
    let cpuSteps = 0;
    while (performance.now() - start < 3000) {
      world.step();
      cpuSteps++;
    }
    const cpuStepsPerSecond = (cpuSteps / (performance.now() - start)) * 1000;

    const loop = await page.evaluate(
      (options) => window.harness.frameLoop(options),
      { ...config, seconds: 5, speed: 0.5 },
    );
    test.info().annotations.push({
      type: "speed",
      description: JSON.stringify({
        gpuStepsPerSecond: gpu.stepsPerSecond,
        cpuStepsPerSecond,
        triangles: gpu.triCount,
        loop,
      }),
    });

    expect(gpu.stepsPerSecond).toBeGreaterThanOrEqual(cpuStepsPerSecond);
    // Simulated seconds per real second reached by the frame loop.
    expect((loop.steps * loop.dt) / 5).toBeGreaterThanOrEqual(0.5 * 0.95);
  });
});
