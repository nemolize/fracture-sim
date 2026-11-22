import { expect, type Page, test } from "@playwright/test";

import type { Snapshot, WorkerResponse } from "../src/rigid/types";
import { openSettings } from "./settings";

declare global {
  interface Window {
    sizedObject?: Snapshot;
    objectExtents?: { width: number; height: number };
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

test("plate bounding box controls update geometry, mass, reset and grab targets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener(
          "message",
          (event: MessageEvent<WorkerResponse>) => {
            const response = event.data;
            if (response.type === "error") return;
            window.sizedObject = response.snapshot;
            if (response.vertices === undefined) return;
            const x: number[] = [],
              y: number[] = [];
            for (let i = 0; i < response.vertices.length; i += 6) {
              if (response.vertices[i + 2] === 4) {
                x.push(response.vertices[i] ?? NaN);
                y.push(response.vertices[i + 1] ?? NaN);
              }
            }
            window.objectExtents = {
              width: Math.max(...x) - Math.min(...x),
              height: Math.max(...y) - Math.min(...y),
            };
          },
        );
      }
    };
  });
  await page.goto("/");
  await openSettings(page);
  const width = page.getByRole("slider", {
    name: "Object width (m)",
    exact: true,
  });
  const height = page.getByRole("slider", {
    name: "Object height (m)",
    exact: true,
  });
  await expect(width).toHaveValue("0.5");
  await expect(height).toHaveValue("0.5");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await setSlider(page, "Object width (m)", 4);
  await setSlider(page, "Object height (m)", 2.4);
  await expect
    .poll(() => page.evaluate(() => window.sizedObject?.stats.mass))
    .toBe(240);
  await expect
    .poll(() => page.evaluate(() => window.objectExtents?.width))
    .toBe(4);
  await expect
    .poll(() => page.evaluate(() => window.objectExtents?.height))
    .toBeCloseTo(2.4, 6);
  await expect
    .poll(() => page.evaluate(() => window.sizedObject?.poses[17]))
    .toBeCloseTo(1.2, 2);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.sizedObject?.stats.time ?? 0))
    .toBeGreaterThan(2);
  expect(await page.evaluate(() => window.sizedObject?.stats.bodies)).toBe(1);
  await page
    .getByRole("group", { name: "Object", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/object-size.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Fracture preset" })
    .selectOption("custom");
  const canvas = page.getByLabel("Fracture simulation");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  // eslint-disable-next-line playwright/no-conditional-in-test -- Playwright bounding boxes are nullable.
  if (box === null) throw new Error("Canvas missing");
  const point = (x: number, y: number) => ({
    x: box.x + (x * box.width) / 10,
    y: box.y + box.height - ((y + 0.4) * box.width) / 10,
  });
  await page.mouse.move(point(5, 1.2).x, point(5, 1.2).y);
  await page.mouse.down();
  await page.mouse.move(point(5, 3.5).x, point(5, 3.5).y, { steps: 20 });
  await expect
    .poll(() => page.evaluate(() => window.sizedObject?.poses[17] ?? 0))
    .toBeGreaterThan(3.3);
  await page.mouse.up();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await openSettings(page);
  await expect(width).toHaveValue("4");
  await expect(height).toHaveValue("2.4");
  await setSlider(page, "Object width (m)", 9);
  await setSlider(page, "Object height (m)", 4);
  await setSlider(page, "World scale", 0.6);
  await expect(width).toHaveValue("5.9");
  await expect
    .poll(async () => Number(await height.inputValue()))
    .toBeCloseTo((4 * 5.9) / 9, 12);
  await expect(width).toHaveAttribute("max", "5.9");
  await expect(height).toHaveAttribute("max", "3.02");
  await expect
    .poll(() => page.evaluate(() => window.sizedObject?.stats.mass))
    .toBeCloseTo(5.9 * ((4 * 5.9) / 9) * 25, 8);
  await page
    .getByRole("combobox", { name: "Scene", exact: true })
    .selectOption("pile");
  await expect(width).toBeDisabled();
  await expect(height).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Scene", exact: true })
    .selectOption("plate");
  await expect(width).toHaveValue("5.9");
  await expect
    .poll(async () => Number(await height.inputValue()))
    .toBeCloseTo((4 * 5.9) / 9, 12);
  expect(errors).toEqual([]);
});
