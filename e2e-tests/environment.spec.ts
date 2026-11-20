import { expect, type Page, test } from "@playwright/test";

import type {
  Snapshot,
  WorkerRequest,
  WorkerResponse,
} from "../src/rigid/types";
import { installIntactPlateFixture, releaseCustomPlate } from "./intact-plate";

declare global {
  interface Window {
    environmentSnapshot?: Snapshot;
    environmentAdvance?: Extract<WorkerRequest, { type: "advance" }>;
    environmentWorkers: number;
  }
}

const setSlider = (page: Page, name: string, value: number) =>
  page.getByRole("slider", { name, exact: true }).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

test("world controls reach physics, resize rendering and preserve pointer metres", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await installIntactPlateFixture(page);
  await page.addInitScript(() => {
    window.environmentWorkers = 0;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      override postMessage(
        message: WorkerRequest,
        transfer: Transferable[] | StructuredSerializeOptions = [],
      ): void {
        if (message.type === "advance") window.environmentAdvance = message;
        super.postMessage(
          message,
          Array.isArray(transfer) ? { transfer } : transfer,
        );
      }
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        window.environmentWorkers++;
        this.addEventListener(
          "message",
          (event: MessageEvent<WorkerResponse>) => {
            if (event.data.type !== "error")
              window.environmentSnapshot = event.data.snapshot;
          },
        );
      }
    };
  });
  await page.goto("/");
  await releaseCustomPlate(page);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await setSlider(page, "Gravity (m/s²)", 0);
  await expect
    .poll(() => page.evaluate(() => window.environmentAdvance?.gravity.y))
    .toBe(0);
  const workers = await page.evaluate(() => window.environmentWorkers);
  await setSlider(page, "Friction coefficient", 0.83);
  await expect
    .poll(() => page.evaluate(() => window.environmentAdvance?.friction))
    .toBe(0.83);
  expect(await page.evaluate(() => window.environmentWorkers)).toBe(workers);
  await setSlider(page, "World width (m)", 18);
  await setSlider(page, "World height (m)", 8);
  await setSlider(page, "Areal density (kg/m²)", 50);
  await expect
    .poll(() => page.evaluate(() => window.environmentSnapshot?.stats.mass))
    .toBe(100);
  await expect
    .poll(() => page.evaluate(() => window.environmentSnapshot?.poses[16]))
    .toBe(9);
  await expect
    .poll(() => page.evaluate(() => window.environmentSnapshot?.poses[5]))
    .toBe(4);
  const canvas = page.getByLabel("Fracture simulation");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  // eslint-disable-next-line playwright/no-conditional-in-test -- Bounding boxes are nullable in Playwright.
  if (box === null) throw new Error("Canvas missing");
  expect(box.width / box.height).toBeCloseTo(18 / 8.4, 2);
  await page.getByRole("complementary").evaluate((panel) => {
    panel.scrollTop = 0;
  });
  await page.screenshot({
    path: "test-results/world-controls.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const point = (x: number, y: number) => ({
    x: box.x + (x * box.width) / 18,
    y: box.y + box.height - ((y + 0.4) * box.width) / 18,
  });
  await page.mouse.move(point(9, 2.5).x, point(9, 2.5).y);
  await page.mouse.down();
  await page.mouse.move(point(13, 5).x, point(13, 5).y, { steps: 20 });
  await expect
    .poll(() => page.evaluate(() => window.environmentSnapshot?.poses[16] ?? 0))
    .toBeGreaterThan(12.8);
  await expect
    .poll(() => page.evaluate(() => window.environmentSnapshot?.poses[17] ?? 0))
    .toBeGreaterThan(4.8);
  await page.mouse.up();
  await setSlider(page, "Gravity (m/s²)", 1.6);
  await expect
    .poll(() => page.evaluate(() => window.environmentAdvance?.gravity.y))
    .toBeCloseTo(-1.6, 8);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "World width (m)", exact: true }),
  ).toHaveValue("18");
  await expect(
    page.getByRole("slider", { name: "Friction coefficient", exact: true }),
  ).toHaveValue("0.83");
  expect(errors).toEqual([]);
});

test.describe("high-DPI world bounds", () => {
  test.use({ deviceScaleFactor: 2 });

  test("renders the tallest narrow world within the GPU texture limit", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await setSlider(page, "World width (m)", 4);
    await setSlider(page, "World height (m)", 20);
    const limit = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter === null) throw new Error("No GPU adapter");
      const device = await adapter.requestDevice();
      const max = device.limits.maxTextureDimension2D;
      device.destroy();
      return max;
    });
    const canvas = page.getByLabel("Fracture simulation");
    await expect
      .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.height))
      .toBeGreaterThan(7000);
    const height = await canvas.evaluate((el: HTMLCanvasElement) => el.height);
    expect(height).toBeLessThanOrEqual(limit);
    expect(errors).toEqual([]);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
