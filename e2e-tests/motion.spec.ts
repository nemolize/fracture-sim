import { expect, test } from "@playwright/test";

import type {
  Snapshot,
  WorkerRequest,
  WorkerResponse,
} from "../src/rigid/types";
import { observeCrackEnergy, selectCustomMaterial } from "./material-fixture";
import { openSettings } from "./settings";

interface Reading3 {
  x: number;
  y: number;
  z: number;
}
declare global {
  interface Window {
    motionAxes: Reading3;
    motionFrame?: Snapshot;
    motionGravity?: { x: number; y: number };
  }
}

test("accelerometer readings lift the plate upside down and preserve measured XY strength", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await observeCrackEnergy(page);
  await page.addInitScript(() => {
    window.motionAxes = { x: 0, y: 9.8, z: 0 };
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      override postMessage(
        message: WorkerRequest,
        transfer: Transferable[] | StructuredSerializeOptions = [],
      ): void {
        if (message.type === "advance") window.motionGravity = message.gravity;
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
            if (event.data.type !== "error")
              window.motionFrame = event.data.snapshot;
          },
        );
      }
    };
    window.setInterval(() => {
      window.dispatchEvent(
        new DeviceMotionEvent("devicemotion", {
          accelerationIncludingGravity: window.motionAxes,
          acceleration: { x: 0, y: 0, z: 0 },
          rotationRate: { alpha: 999, beta: 999, gamma: 999 },
        }),
      );
    }, 40);
  });
  await page.goto("/");
  await openSettings(page);
  await selectCustomMaterial(page);
  await expect(page.getByLabel("Device tilt")).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => window.motionFrame?.stats.sleeping))
    .toBe(1);
  const toughness = page.getByRole("slider", {
    name: "Fracture energy (J/m²)",
  });
  await toughness.press("End");
  await expect(toughness).toHaveAttribute("aria-valuetext", "1,000,000 J/m²");
  await page.evaluate(() => {
    window.motionAxes = { x: 0, y: -9.8, z: 0 };
  });
  await expect
    .poll(() => page.evaluate(() => window.motionGravity?.y ?? -Infinity))
    .toBeGreaterThan(9.7);
  await expect
    .poll(() => page.evaluate(() => window.motionFrame?.poses[17] ?? -Infinity))
    .toBeGreaterThan(4.5);
  expect(await page.evaluate(() => window.motionFrame?.stats.bodies)).toBe(1);
  await page.screenshot({
    path: "test-results/device-tilt-inverted.png",
    fullPage: true,
  });

  await page.evaluate(() => {
    window.motionAxes = { x: -3, y: 0, z: 4 };
  });
  await expect
    .poll(() =>
      page.evaluate(() => Math.abs((window.motionGravity?.x ?? Infinity) - 3)),
    )
    .toBeLessThan(0.03);
  await expect
    .poll(() =>
      page.evaluate(() => Math.abs(window.motionGravity?.y ?? Infinity)),
    )
    .toBeLessThan(0.03);

  await page.evaluate(() => {
    window.motionAxes = { x: 0, y: 0, z: 9.8 };
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.hypot(
          window.motionGravity?.x ?? Infinity,
          window.motionGravity?.y ?? Infinity,
        ),
      ),
    )
    .toBeLessThan(0.03);

  await page.evaluate(() => {
    Object.defineProperty(window.screen, "orientation", {
      value: { angle: 90 },
      configurable: true,
    });
    window.motionAxes = { x: 9.8, y: 0, z: 0 };
  });
  await expect
    .poll(() => page.evaluate(() => window.motionGravity?.y ?? Infinity))
    .toBeLessThan(-9.7);
  await expect
    .poll(() => page.evaluate(() => window.motionFrame?.poses[17] ?? Infinity))
    .toBeLessThan(0.7);
  expect(errors).toEqual([]);
});
