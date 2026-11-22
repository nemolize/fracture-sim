import { expect, test } from "@playwright/test";

import type { WorkerResponse } from "../src/rigid/types";
import { openSettings, useWidePlate } from "./settings";

declare global {
  interface Window {
    supportMaxBodies: number;
    supportTime: number;
  }
}

test("sensor noise and friction changes preserve Glass, while a real impact still fractures it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    window.supportMaxBodies = 0;
    window.supportTime = 0;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener(
          "message",
          (event: MessageEvent<WorkerResponse>) => {
            if (event.data.type !== "error") {
              const stats = event.data.snapshot.stats;
              window.supportMaxBodies = Math.max(
                window.supportMaxBodies,
                stats.bodies,
              );
              window.supportTime = stats.time;
            }
          },
        );
      }
    };
    let sample = 0;
    window.setInterval(() => {
      sample++;
      window.dispatchEvent(
        new DeviceMotionEvent("devicemotion", {
          accelerationIncludingGravity: {
            x: Math.sin(sample) * 0.01,
            y: 9.8 + Math.cos(sample) * 0.01,
            z: 0,
          },
          acceleration: { x: 0, y: 0, z: 0 },
        }),
      );
    }, 40);
  });
  await page.goto("/");
  await useWidePlate(page);
  await openSettings(page);
  await expect(page.getByLabel("Device tilt")).toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Fracture preset" }),
  ).toHaveValue("glass");
  await expect
    .poll(() => page.evaluate(() => window.supportTime))
    .toBeGreaterThan(2);
  expect(await page.evaluate(() => window.supportMaxBodies)).toBe(1);
  await page
    .getByRole("slider", { name: "Friction coefficient", exact: true })
    .evaluate((input) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "0.51");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await expect
    .poll(() => page.evaluate(() => window.supportTime))
    .toBeGreaterThan(4);
  expect(await page.evaluate(() => window.supportMaxBodies)).toBe(1);
  await page
    .getByRole("group", { name: "Material", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/support-stable.png",
    fullPage: true,
  });
  await page.getByLabel("Throw ball").check();
  const canvas = page.getByLabel("Fracture simulation");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  // eslint-disable-next-line playwright/no-conditional-in-test -- Playwright bounding boxes are nullable.
  if (box === null) throw new Error("Canvas missing");
  const y = box.y + box.height - (1 * box.width) / 10;
  await page.mouse.move(box.x + box.width / 10, y);
  await page.mouse.down();
  await page.mouse.move(box.x + (5 * box.width) / 10, y, { steps: 20 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.supportMaxBodies))
    .toBeGreaterThan(2);
  await page.screenshot({
    path: "test-results/support-impact.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
