import { expect, type Page, test } from "@playwright/test";

import type { Snapshot, WorkerResponse } from "../src/rigid/types";

declare global {
  interface Window {
    shapeFrame?: Snapshot;
    shapeVertices?: Float32Array;
  }
}
const setSize = (page: Page, name: string, value: number) =>
  page.getByRole("slider", { name, exact: true }).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

for (const item of [
  {
    id: "ellipse",
    area: 8 * Math.sin(Math.PI / 16),
    vertices: 32,
    naturalHeight: 2,
  },
  { id: "triangle", area: 1, vertices: 3, naturalHeight: Math.sqrt(3) },
  { id: "hexagon", area: 1.5, vertices: 6, naturalHeight: Math.sqrt(3) },
]) {
  test(`${item.id} renders at selected dimensions, stays grounded and fractures on impact`, async ({
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
              if (event.data.type !== "error") {
                window.shapeFrame = event.data.snapshot;
                if (event.data.vertices !== undefined)
                  window.shapeVertices = event.data.vertices;
              }
            },
          );
        }
      };
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const select = page.getByRole("combobox", { name: "Object shape" });
    await select.selectOption(item.id);
    const { naturalHeight } = item;
    await expect
      .poll(() => page.evaluate(() => window.shapeFrame?.stats.mass))
      .toBeCloseTo(item.area * naturalHeight * 25, 8);
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole("slider", { name: "Object height (m)", exact: true })
            .inputValue(),
        ),
      )
      .toBeCloseTo(naturalHeight, 12);
    await page
      .getByRole("group", { name: "Object", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/shape-${item.id}-natural.png`,
      fullPage: true,
    });
    await setSize(page, "Object width (m)", 3);
    await setSize(page, "Object height (m)", 1.5);
    const mass = item.area * 2.25 * 25;
    await expect
      .poll(() => page.evaluate(() => window.shapeFrame?.stats.mass))
      .toBeCloseTo(mass, 8);
    const geometry = await page.evaluate(() => {
      const v = window.shapeVertices;
      if (v === undefined) throw new Error("Missing vertices");
      const x: number[] = [],
        y: number[] = [];
      for (let i = 0; i < v.length; i += 6)
        if (v[i + 2] === 4) {
          x.push(v[i] ?? NaN);
          y.push(v[i + 1] ?? NaN);
        }
      return {
        width: Math.max(...x) - Math.min(...x),
        height: Math.max(...y) - Math.min(...y),
        bottom: Math.min(...y) + (window.shapeFrame?.poses[17] ?? NaN),
        points: x.length,
      };
    });
    expect(geometry.width).toBeCloseTo(3, 6);
    expect(geometry.height).toBeCloseTo(1.5, 6);
    expect(geometry.bottom).toBeCloseTo(0, 2);
    expect(geometry.points).toBe((item.vertices - 2) * 3);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(select).toHaveValue(item.id);
    await expect(
      page.getByRole("slider", { name: "Object width (m)", exact: true }),
    ).toHaveValue("3");
    await expect(
      page.getByRole("slider", { name: "Object height (m)", exact: true }),
    ).toHaveValue("1.5");
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.shapeFrame?.stats.time ?? 0))
      .toBeGreaterThan(1);
    expect(await page.evaluate(() => window.shapeFrame?.stats.bodies)).toBe(1);
    await page
      .getByRole("group", { name: "Object", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/shape-${item.id}.png`,
      fullPage: true,
    });
    await page.getByLabel("Throw ball").check();
    const canvas = page.getByLabel("Fracture simulation");
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Playwright bounding boxes are nullable.
    if (box === null) throw new Error("Canvas missing");
    const y = box.y + box.height - box.width / 10;
    await page.mouse.move(box.x + box.width / 10, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, y, { steps: 20 });
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => window.shapeFrame?.stats.bodies ?? 0))
      .toBeGreaterThan(2);
    expect(
      await page.evaluate(() => window.shapeFrame?.stats.mass),
    ).toBeCloseTo(mass + 2, 8);
    await page.screenshot({
      path: `test-results/shape-${item.id}-impact.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await setSize(page, "World scale", 3);
    await setSize(page, "Object width (m)", 29.9);
    await setSize(page, "Object height (m)", 0.1);
    await expect
      .poll(() => page.evaluate(() => window.shapeFrame?.stats.mass))
      .toBeCloseTo((item.area * 29.9 * 0.1 * 25) / 2, 8);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.shapeFrame?.stats.time ?? 0))
      .toBeGreaterThan(1);
    expect(await page.evaluate(() => window.shapeFrame?.stats.bodies)).toBe(1);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await setSize(page, "World scale", 1);
    await setSize(page, "Object width (m)", 5);
    await select.selectOption("rectangle");
    await select.selectOption(item.id);
    await setSize(page, "World scale", 0.7);
    const fittedWidth = (3.54 * 2) / naturalHeight;
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole("slider", { name: "Object width (m)", exact: true })
            .inputValue(),
        ),
      )
      .toBeCloseTo(fittedWidth, 12);
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole("slider", { name: "Object height (m)", exact: true })
            .inputValue(),
        ),
      )
      .toBeCloseTo(3.54, 12);
    await expect
      .poll(() => page.evaluate(() => window.shapeFrame?.stats.mass))
      .toBeCloseTo(((item.area * fittedWidth * 3.54) / 2) * 25, 8);
    await select.selectOption("rectangle");
    await setSize(page, "Object width (m)", 8);
    await select.selectOption(item.id);
    await expect
      .poll(() => page.evaluate(() => window.shapeFrame?.stats.mass))
      .toBeCloseTo(((item.area * fittedWidth * 3.54) / 2) * 25, 8);
    expect(errors).toEqual([]);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}
