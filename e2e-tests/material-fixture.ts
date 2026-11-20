import { expect, type Page } from "@playwright/test";

import type { WorkerRequest } from "../src/rigid/types";

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
        if (message.type === "advance" && message.crackEnergy !== undefined)
          window.fixtureCrackEnergy = message.crackEnergy;
        super.postMessage(
          message,
          Array.isArray(transfer) ? { transfer } : transfer,
        );
      }
    };
  });
};

export const selectCustomMaterial = async (page: Page): Promise<void> => {
  await page
    .getByRole("combobox", { name: "Fracture preset" })
    .selectOption("custom");
  await expect
    .poll(() => page.evaluate(() => window.fixtureCrackEnergy))
    .toBe(10000);
};
