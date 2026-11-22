import { expect, type Page } from "@playwright/test";

import type { WorkerRequest } from "../src/rigid/types";
import { openSettings } from "./settings";

declare global {
  interface Window {
    fixtureCrackEnergy?: number;
  }
}

export const observeCrackEnergy = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      override postMessage(
        message: WorkerRequest,
        transfer: Transferable[] | StructuredSerializeOptions = [],
      ): void {
        if (message.type === "advance" && message.materials !== undefined)
          window.fixtureCrackEnergy = message.materials.crackEnergy;
        super.postMessage(
          message,
          Array.isArray(transfer) ? { transfer } : transfer,
        );
      }
    };
  });
};

/** Leaves the settings popup as it found it, so pointer tests keep the canvas clear. */
export const makePlateUnbreakable = async (page: Page): Promise<void> => {
  const toggle = page.getByRole("button", { name: "Settings", exact: true });
  const wasOpen = (await toggle.getAttribute("aria-expanded")) === "true";
  await openSettings(page);
  // The top of the slider (10^6 J/m²) makes a 10 mm plate effectively unbreakable.
  await page.getByRole("slider", { name: "Fracture energy (J/m²)" }).fill("6");
  await expect
    .poll(() => page.evaluate(() => window.fixtureCrackEnergy))
    .toBe(10000);
  if (!wasOpen) await toggle.click();
};
