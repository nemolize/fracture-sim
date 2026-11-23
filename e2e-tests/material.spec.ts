import { expect, test } from "@playwright/test";

import type { WorkerRequest, WorkerResponse } from "../src/rigid/types";
import type { LiveMaterials } from "../src/sim/material";
import { openSettings } from "./settings";

declare global {
  interface Window {
    materialCrackEnergy?: number;
    materialMinArea?: number;
    materialLive?: LiveMaterials | undefined;
    materialBodyCount?: number;
    materialTime?: number;
  }
}

test("real material presets convert Gc and thickness before reaching the worker", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      override postMessage(
        message: WorkerRequest,
        transfer: Transferable[] | StructuredSerializeOptions = [],
      ): void {
        if (message.type === "advance" && message.materials !== undefined) {
          window.materialCrackEnergy = message.materials.crackEnergy;
          window.materialMinArea = message.materials.minFragmentArea;
        }
        if (message.type === "advance") window.materialLive = message.materials;
        super.postMessage(
          message,
          Array.isArray(transfer) ? { transfer } : transfer,
        );
      }
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener(
          "message",
          (event: MessageEvent<WorkerResponse>) => {
            if (event.data.type !== "error") {
              window.materialBodyCount = event.data.snapshot.stats.bodies;
              window.materialTime = event.data.snapshot.stats.time;
            }
          },
        );
      }
    };
  });
  await page.goto("/");
  await openSettings(page);
  const preset = page.getByRole("combobox", { name: "Object material preset" });
  const energy = page.getByRole("slider", { name: "Fracture energy (J/m²)" });
  const thickness = page.getByRole("slider", { name: "Thickness (mm)" });
  await expect(preset).toHaveValue("glass");
  await expect(energy).toHaveAttribute("aria-valuetext", "7 J/m²");
  await expect(page.getByLabel("Simulation statistics")).toContainText(
    "Crack energy0.07 J/m",
  );
  await expect
    .poll(() => page.evaluate(() => window.materialTime ?? 0))
    .toBeGreaterThan(2);
  expect(await page.evaluate(() => window.materialBodyCount)).toBe(1);
  await page.screenshot({
    path: "test-results/material-presets.png",
    fullPage: true,
  });
  for (const item of [
    { id: "glass", gc: "7 J/m²", line: 0.07 },
    { id: "ice", gc: "1.5 J/m²", line: 0.015 },
    { id: "pmma", gc: "500 J/m²", line: 5 },
    { id: "polystyrene", gc: "400 J/m²", line: 4 },
  ]) {
    await preset.selectOption(item.id);
    await expect(energy).toHaveAttribute("aria-valuetext", item.gc);
    await expect
      .poll(() => page.evaluate(() => window.materialCrackEnergy))
      .toBe(item.line);
  }
  await preset.selectOption("ice");
  await page.screenshot({
    path: "test-results/material-ice.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await thickness.press("ArrowRight");
  await expect(thickness).toHaveValue("10.1");
  await expect
    .poll(() => page.evaluate(() => window.materialCrackEnergy))
    .toBeCloseTo(0.01515, 12);
  const minArea = page.getByRole("slider", { name: "Min fragment area (m²)" });
  await expect
    .poll(() => page.evaluate(() => window.materialMinArea))
    .toBe(0.01);
  await minArea.press("ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.materialMinArea))
    .toBeCloseTo(10 ** -1.99, 12);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await openSettings(page);
  await expect(preset).toHaveValue("ice");
  await expect(thickness).toHaveValue("10.1");
  await energy.press("ArrowRight");
  await expect(preset).toHaveValue("custom");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  expect(errors).toEqual([]);
});

test("the floor and the object materials reach the real worker, and density restarts the scene", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      override postMessage(
        message: WorkerRequest,
        transfer: Transferable[] | StructuredSerializeOptions = [],
      ): void {
        if (message.type === "advance") window.materialLive = message.materials;
        super.postMessage(
          message,
          Array.isArray(transfer) ? { transfer } : transfer,
        );
      }
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener(
          "message",
          (event: MessageEvent<WorkerResponse>) => {
            if (event.data.type === "ready") window.materialTime = -1;
            else if (event.data.type !== "error")
              window.materialTime = event.data.snapshot.stats.time;
          },
        );
      }
    };
  });
  await page.goto("/");
  await openSettings(page);
  await page
    .getByRole("combobox", { name: "Floor material preset" })
    .selectOption("rubber");
  await page
    .getByRole("combobox", { name: "Object material preset" })
    .selectOption("ice");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const live = window.materialLive;
        return live === undefined
          ? undefined
          : [
              live.floor.friction,
              live.floor.restitution,
              live.object.friction,
              live.object.restitution,
            ];
      }),
    )
    .toEqual([1.2, 0.8, 0.1, 0.05]);
  await expect
    .poll(() => page.evaluate(() => window.materialTime ?? 0))
    .toBeGreaterThan(1);
  const density = page.getByRole("slider", { name: "Object density (kg/m³)" });
  await density.press("ArrowRight");
  await expect(page.getByLabel("Simulation statistics")).toContainText(
    "Areal density9.18 kg/m²",
  );
  await expect
    .poll(() => page.evaluate(() => window.materialTime ?? 0))
    .toBeLessThan(1);
  expect(errors).toEqual([]);
});
