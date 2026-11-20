import { expect, type Page, test } from "@playwright/test";

import type { Harness } from "../src/harness/main";

declare global {
  interface Window {
    harness: Harness;
  }
}

test("worker fractures a plate dropped 2 m and transfers matching geometry", async ({
  page,
}) => {
  await page.goto("/harness.html");
  const result = await page.evaluate(async () => {
    const initial = await window.harness.reset("plate");
    let frame = initial;
    let geometryChanged = false;
    for (let i = 0; i < 100; i++) {
      frame = await window.harness.step(0.1, { x: 0, y: -9.8 }, 12);
      if (frame.type === "frame" && frame.vertices !== undefined) {
        geometryChanged = true;
        for (let j = 2; j < frame.vertices.length; j += 6) {
          const body = frame.vertices[j] ?? Infinity;
          if (body * 4 + 3 >= frame.snapshot.poses.length)
            throw new Error("Geometry/pose mismatch");
        }
      }
    }
    if (initial.type !== "ready" || frame.type !== "frame")
      throw new Error("Worker failed");
    return {
      initialY: initial.snapshot.poses[17],
      geometryChanged,
      finalY: frame.snapshot.poses[17],
      stats: frame.snapshot.stats,
      finite: frame.snapshot.poses.every(Number.isFinite),
    };
  });
  expect(result.initialY).toBe(2.5);
  expect(result.geometryChanged).toBe(true);
  expect(result.finalY).toBeGreaterThan(0);
  expect(result.stats.bodies).toBeGreaterThan(1);
  expect(result.stats.sleeping).toBe(result.stats.bodies);
  expect(result.stats.mass).toBeCloseTo(50, 12);
  expect(result.finite).toBe(true);
});

test("1000 bodies sleep inside the container within 20 simulated seconds", async ({
  page,
}) => {
  await page.goto("/harness.html");
  const result = await page.evaluate(async () => {
    await window.harness.reset("pile");
    let frame = await window.harness.step(0.1);
    for (let i = 1; i < 200; i++) frame = await window.harness.step(0.1);
    if (frame.type !== "frame") throw new Error("Worker failed");
    const { poses, stats } = frame.snapshot;
    let contained = true;
    for (let i = 16; i < poses.length; i += 4) {
      const x = poses[i] ?? NaN;
      const y = poses[i + 1] ?? NaN;
      contained &&= x > 0 && x < 10 && y > 0 && y < 5.2;
    }
    return { stats, contained, finite: poses.every(Number.isFinite) };
  });
  expect(result.stats.bodies).toBeGreaterThanOrEqual(1000);
  expect(result.stats.bodies).toBeLessThanOrEqual(2000);
  expect(result.stats.sleeping).toBe(result.stats.bodies);
  expect(result.stats.mass).toBeCloseTo(360, 10);
  expect(result.stats.time).toBeCloseTo(20);
  expect(result.contained).toBe(true);
  expect(result.finite).toBe(true);
});

const glassPixels = async (page: Page): Promise<number> => {
  const screenshot = await page.getByLabel("Fracture simulation").screenshot();
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = surface.getContext("2d");
    if (context === null) throw new Error("No screenshot decoding context");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        Math.abs((pixels[i] ?? 0) - 41) < 8 &&
        Math.abs((pixels[i + 1] ?? 0) - 161) < 8 &&
        Math.abs((pixels[i + 2] ?? 0) - 194) < 8
      )
        count++;
    }
    bitmap.close();
    return count;
  }, screenshot.toString("base64"));
};

test("WebGPU renders the plate, follows motion, and rebuilds scenes without diagnostics", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await page.evaluate(() => {
    window.dispatchEvent(
      new DeviceMotionEvent("devicemotion", {
        accelerationIncludingGravity: { x: -9.8, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
      }),
    );
  });
  await expect(page.getByLabel("Device tilt")).toBeEnabled();
  const stats = page.getByLabel("Simulation statistics");
  await expect(stats).toContainText(/Bodies[2-9][0-9]*/);
  await expect(stats).toContainText(/Sleeping[1-9][0-9]*/);
  const canvas = page.getByLabel("Fracture simulation");
  await expect.poll(() => glassPixels(page)).toBeGreaterThan(500);
  const before = await canvas.screenshot();
  await page.evaluate(() => {
    window.dispatchEvent(
      new DeviceMotionEvent("devicemotion", {
        accelerationIncludingGravity: { x: -9.8, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
      }),
    );
  });

  await expect(page.getByLabel("Device tilt")).toBeEnabled();
  await expect(page.getByLabel("Device tilt")).toBeChecked();
  await expect
    .poll(async () => Buffer.compare(before, await canvas.screenshot()))
    .not.toBe(0);
  await page.getByRole("combobox", { name: /^Scene/ }).selectOption("pile");
  await expect(stats).toContainText(/Bodies1[0-9]{3}/);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(stats).toContainText(/Bodies1[0-9]{3}/);
  await expect.poll(() => glassPixels(page)).toBeGreaterThan(500);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/rigid-world.png" });
});

test("physics worker failure stops the app and explains the failure", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    class BrokenWorker extends NativeWorker {
      constructor(url: URL | string, options?: WorkerOptions) {
        super(url, options);
        queueMicrotask(() =>
          this.dispatchEvent(
            new ErrorEvent("error", { message: "WASM initialization failed" }),
          ),
        );
      }
    }
    window.Worker = BrokenWorker;
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("The physics stopped");
  await expect(page.getByRole("alert")).toContainText(
    "WASM initialization failed",
  );
  await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();
});

test("settled 2000-body browser-worker pile has p95 physics step under 8 ms", async ({
  page,
}) => {
  await page.goto("/harness.html");
  const measured = await page.evaluate(async () => {
    await window.harness.reset("stress");
    for (let i = 0; i < 200; i++) await window.harness.step(0.1);
    const samples: number[] = [];
    let asleep = 0;
    for (let i = 0; i < 600; i++) {
      const frame = await window.harness.step(1 / 60);
      if (frame.type !== "frame") throw new Error("Worker failed");
      samples.push(frame.snapshot.stats.stepMs);
      asleep = frame.snapshot.stats.sleeping;
    }
    samples.sort((a, b) => a - b);
    return {
      p95: samples[569] ?? Infinity,
      count: samples.length,
      asleep,
      userAgent: navigator.userAgent,
    };
  });
  console.log("rigid-worker benchmark", JSON.stringify(measured));
  expect(measured.count).toBe(600);
  expect(measured.asleep).toBe(2000);
  expect(measured.p95).toBeLessThan(8);
});
