import { expect, type Page, test } from "@playwright/test";

import { isPreviewTarget } from "./target";

declare global {
  interface Window {
    /** Installed by the device-loss test's init script. */
    loseDevice?: () => void;
  }
}

test("should load the rigid-body simulator", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Fracture Sim");
  await expect(page.getByLabel("Fracture simulation")).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^Scene/ })).toHaveValue(
    "plate",
  );
  await expect(page.getByLabel("Simulation statistics")).toContainText(
    /Bodies[1-9][0-9]*/,
  );
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByLabel("Simulation statistics")).toContainText(
    /Bodies[1-9][0-9]*/,
  );
});

test.describe("without a usable WebGPU", () => {
  const expectNoSimulation = async (page: Page) => {
    await expect(
      page.getByRole("heading", { name: "WebGPU is required" }),
    ).toBeVisible();
    await expect(page.getByLabel("Fracture simulation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: /^Scene/ })).toBeDisabled();
  };

  test("should say WebGPU is required when navigator.gpu is missing", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "gpu", { value: undefined });
    });
    await page.goto("/");

    await expectNoSimulation(page);
  });

  test("should say WebGPU is required when there is no adapter", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      navigator.gpu.requestAdapter = () => Promise.resolve(null);
    });
    await page.goto("/");

    await expectNoSimulation(page);
  });

  test("should say WebGPU is required when the device request fails", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      GPUAdapter.prototype.requestDevice = () =>
        Promise.reject(new Error("device refused"));
    });
    await page.goto("/");

    await expectNoSimulation(page);
    await expect(page.getByRole("alert")).toContainText("device refused");
  });
});

test("should stop and say so when the GPU device is lost", async ({ page }) => {
  // The page cannot make the browser lose a device, so give it one whose
  // `lost` promise the test resolves.
  await page.addInitScript(() => {
    // Wrapping the prototype method; each call goes back through `.apply(this)`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (...args) {
      const device = await original.apply(this, args);
      const lost = new Promise<GPUDeviceLostInfo>((resolve) => {
        Object.assign(window, {
          loseDevice: () => {
            resolve({ reason: "unknown", message: "the GPU process crashed" });
          },
        });
      });
      Object.defineProperty(device, "lost", { value: lost });
      return device;
    };
  });
  await page.goto("/");
  await expect(page.getByLabel("Fracture simulation")).toBeVisible();

  await page.evaluate(() => {
    window.loseDevice?.();
  });

  await expect(page.getByRole("alert")).toContainText("The GPU stopped");
  await expect(page.getByRole("alert")).toContainText(
    "the GPU process crashed",
  );
  await expect(page.getByLabel("Fracture simulation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: /^Scene/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
});

test("should serve the SPA shell for a deep route with no file on disk", async ({
  page,
}) => {
  await page.goto("/some/deep/route");

  await expect(page).toHaveTitle("Fracture Sim");
  await expect(
    page.getByRole("heading", { name: "Fracture Sim" }),
  ).toBeVisible();
});

test("should serve the app from hashed production assets", async ({ page }) => {
  test.skip(!isPreviewTarget, "only meaningful against the production build");

  await page.goto("/");

  const scriptSrc =
    (await page.locator('script[type="module"]').getAttribute("src")) ?? "";
  expect(scriptSrc).toMatch(/^\/assets\/index-[\w-]+\.js$/);

  const response = await page.request.get(scriptSrc);
  expect(response.status()).toBe(200);

  const stylesheet = page.locator('link[rel="stylesheet"]');
  await expect(stylesheet).toHaveAttribute(
    "href",
    /^\/assets\/index-[\w-]+\.css$/,
  );
  const stylesheetHref = (await stylesheet.getAttribute("href")) ?? "";
  const stylesheetResponse = await page.request.get(stylesheetHref);
  expect(stylesheetResponse.status()).toBe(200);
  expect(stylesheetResponse.headers()["content-type"]).toMatch(/^text\/css\b/);

  await expect(page.getByRole("heading", { name: "Fracture Sim" })).toHaveCSS(
    "font-size",
    "24px",
  );
});
