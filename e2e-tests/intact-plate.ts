import { expect, type Page } from "@playwright/test";

import type { WorkerRequest, WorkerResponse } from "../src/rigid/types";

declare global {
  interface Window {
    heldPlateWorker?: Worker;
    holdInitialPlate: boolean;
    fixtureCrackEnergy?: number;
  }
}

export const installIntactPlateFixture = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.holdInitialPlate = true;
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
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener(
          "message",
          (event: MessageEvent<WorkerResponse>) => {
            if (
              event.data.type === "ready" &&
              window.holdInitialPlate &&
              window.location.pathname === "/"
            ) {
              window.heldPlateWorker = this;
              this.postMessage({
                type: "action",
                action: { type: "grab", point: { x: 5, y: 2.5 } },
              });
            }
          },
        );
      }
    };
  });
};

export const releaseCustomPlate = async (page: Page): Promise<void> => {
  await page
    .getByRole("combobox", { name: "Fracture preset" })
    .selectOption("custom");
  await expect
    .poll(() => page.evaluate(() => window.fixtureCrackEnergy))
    .toBe(10000);
  await expect
    .poll(() => page.evaluate(() => window.heldPlateWorker !== undefined))
    .toBe(true);
  await page.evaluate(() => {
    window.holdInitialPlate = false;
    window.heldPlateWorker?.postMessage({
      type: "action",
      action: { type: "release", velocity: { x: 0, y: 0 } },
    });
  });
};
