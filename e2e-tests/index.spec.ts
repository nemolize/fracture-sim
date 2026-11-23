import { expect, type Page, test } from "@playwright/test";

import { openSettings } from "./settings";
import { isPreviewTarget } from "./target";

declare global {
  interface Window {
    /** Installed by the device-loss test's init script. */
    loseDevice?: () => void;
  }
}

test("should load the rigid-body simulator", async ({ page }) => {
  await page.goto("/");
  await openSettings(page);
  await expect(page).toHaveTitle("Fracture Sim");
  await expect(page.getByLabel("Fracture simulation")).toBeVisible();
  await expect(page.getByLabel("Simulation statistics")).toContainText(
    /Bodies[1-9][0-9]*/,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await openSettings(page);
  await expect(page.getByLabel("Simulation statistics")).toContainText(
    /Bodies[1-9][0-9]*/,
  );
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`should fill the ${viewport.name} window height with the canvas`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const canvas = page.getByLabel("Fracture simulation");
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => {
        const box = await canvas.boundingBox();
        return box === null ? 0 : box.y + box.height;
      })
      .toBeGreaterThanOrEqual(viewport.height - 16);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
    );
    expect(overflow).toBe(0);
  });
}

test("should reset one setting or every parameter from the popup", async ({
  page,
}) => {
  await page.goto("/");
  await openSettings(page);
  const gravity = page.getByRole("slider", { name: "Gravity (m/s²)" });
  const friction = page.getByRole("slider", {
    name: "Floor friction coefficient",
  });
  const defaults = {
    gravity: await gravity.inputValue(),
    friction: await friction.inputValue(),
  };
  await gravity.fill("3");
  await friction.fill("1.5");
  await page.getByRole("button", { name: "Reset Gravity (m/s²)" }).click();
  await expect(gravity).toHaveValue(defaults.gravity);
  await expect(friction).toHaveValue("1.5");
  await page.getByRole("button", { name: "Reset parameters" }).click();
  await expect(friction).toHaveValue(defaults.friction);
});

test.describe("without a usable WebGPU", () => {
  const expectNoSimulation = async (page: Page) => {
    await expect(
      page.getByRole("heading", { name: "WebGPU is required" }),
    ).toBeVisible();
    await expect(page.getByLabel("Fracture simulation")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Reset", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Object shape", exact: true }),
    ).toBeDisabled();
  };

  test("should say WebGPU is required when navigator.gpu is missing", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "gpu", { value: undefined });
    });
    await page.goto("/");
    await openSettings(page);

    await expectNoSimulation(page);
  });

  test("should say WebGPU is required when there is no adapter", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      navigator.gpu.requestAdapter = () => Promise.resolve(null);
    });
    await page.goto("/");
    await openSettings(page);

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
    await openSettings(page);

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
  await openSettings(page);
  await expect(page.getByLabel("Fracture simulation")).toBeVisible();

  await page.evaluate(() => {
    window.loseDevice?.();
  });

  await expect(page.getByRole("alert")).toContainText("The GPU stopped");
  await expect(page.getByRole("alert")).toContainText(
    "the GPU process crashed",
  );
  await expect(page.getByLabel("Fracture simulation")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reset", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Object shape", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
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

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`should keep the stats panel width steady on a ${viewport.name} window as the body count grows`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const stats = page.getByLabel("Simulation statistics");
    await expect(stats).toContainText(/Bodies[1-9][0-9]*/);
    const widthOf = async (): Promise<number> =>
      (await stats.boundingBox())?.width ?? NaN;
    const before = await widthOf();
    await page.getByLabel("Throw ball").check();
    const canvas = page.getByLabel("Fracture simulation");
    const box = await canvas.boundingBox();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Playwright bounding boxes are nullable.
    if (box === null) throw new Error("Canvas missing");
    for (let i = 0; i < 12; i++)
      await canvas.click({
        position: { x: box.width * (0.1 + i * 0.07), y: box.height * 0.55 },
      });
    await expect(stats).toContainText(/Bodies[0-9]{2,}/);
    expect(await widthOf()).toBe(before);
    const rem = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    const minWidth = 12 * rem;
    expect(before).toBeGreaterThanOrEqual(minWidth);
  });
}
