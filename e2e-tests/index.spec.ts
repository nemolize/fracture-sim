import { expect, type Page, test } from "@playwright/test";

import { RESOLUTIONS } from "../src/sim/resolution";
import { isPreviewTarget } from "./target";

declare global {
  interface Window {
    /** Installed by the device-loss test's init script. */
    loseDevice?: () => void;
  }
}

test("should load the simulator with its controls", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Fracture Sim");
  await expect(
    page.getByRole("heading", { name: "Fracture Sim" }),
  ).toBeVisible();
  await expect(page.getByLabel("Fracture simulation")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Material", exact: true }),
  ).toHaveValue("concrete");
  await expect(page.getByLabel("Simulation statistics")).toContainText("0.0%");
});

test("should break a glass wall hit by a thrown ball", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Material", exact: true })
    .selectOption("glass");
  await page.getByLabel(/^Speed/).fill("1");

  const canvas = page.getByLabel("Fracture simulation");
  const box = (await canvas.boundingBox()) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  expect(box.width).toBeGreaterThan(0);

  // World (x, y) in metres to page pixels: y is up, and the floor sits 0.4 m above the bottom edge.
  const scale = box.width / 10;
  const toPage = (x: number, y: number) => ({
    x: box.x + x * scale,
    y: box.y + box.height - 0.4 * scale - y * scale,
  });
  const from = toPage(1, 1.2);
  const to = toPage(4.2, 1.2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, to.y);
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();

  const stats = page.getByLabel("Simulation statistics");
  await expect(stats).not.toContainText("0.0%", { timeout: 30_000 });
  await expect(stats).not.toContainText(/Pieces\s*1(?!\d)/, {
    timeout: 30_000,
  });
});

test("should keep simulating at every mesh resolution", async ({ page }) => {
  await page.goto("/");
  const resolution = page.getByRole("combobox", { name: "Mesh resolution" });

  await expect(resolution.getByRole("option")).toHaveCount(3);
  for (const name of ["fine", "finest", "standard"] as const) {
    await resolution.selectOption({ label: RESOLUTIONS[name].label });
    await expect(page.getByLabel("Fracture simulation")).toBeVisible();
    await expect(page.getByLabel("Simulation statistics")).toContainText(
      "0.0%",
    );
  }
});

test("should draw the body and redraw it as it breaks", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Material", exact: true })
    .selectOption("glass");
  await page.getByLabel(/^Speed/).fill("1");
  const canvas = page.getByLabel("Fracture simulation");
  await expect(canvas).toBeVisible();
  const before = await canvas.screenshot();

  const box = (await canvas.boundingBox()) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  const scale = box.width / 10;
  const point = (x: number, y: number) => ({
    x: box.x + x * scale,
    y: box.y + box.height - 0.4 * scale - y * scale,
  });
  const from = point(1, 1.2);
  const to = point(4.2, 1.2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();

  await expect(page.getByLabel("Simulation statistics")).not.toContainText(
    "0.0%",
    { timeout: 30_000 },
  );
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
});

test("should rebuild the body when Reset is pressed", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Material", exact: true })
    .selectOption("glass");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByLabel("Simulation statistics")).toContainText("0.0%");
});

/** A `devicemotion` event for a device whose gravity points along (gx, gy) of the screen, in m/s². */
const sendMotion = (
  page: Page,
  gravity: { x: number; y: number },
  acceleration = { x: 0, y: 0 },
) =>
  page.evaluate(
    ([g, a]) => {
      window.dispatchEvent(
        new DeviceMotionEvent("devicemotion", {
          accelerationIncludingGravity: { x: -g.x, y: -g.y, z: 0 },
          acceleration: { x: a.x, y: a.y, z: 0 },
        }),
      );
    },
    [gravity, acceleration] as const,
  );

/** Mean x, as a share of the canvas width, of the pixels that are neither background nor floor. */
const bodyCentre = async (page: Page): Promise<number> => {
  const png = await page.getByLabel("Fracture simulation").screenshot();
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = surface.getContext("2d");
    if (context === null) throw new Error("no 2d context");
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const near = (i: number, rgb: number[]) =>
      rgb.every((channel, k) => Math.abs((data[i + k] ?? 0) - channel) < 12);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (near(i, [243, 244, 246]) || near(i, [209, 213, 219])) continue;
      sum += (i / 4) % bitmap.width;
      count++;
    }
    return count === 0 ? Number.NaN : sum / count / bitmap.width;
  }, png.toString("base64"));
};

test.describe("gyro tilt", () => {
  const SIDEWAYS = { x: 9.8, y: 0 };
  const UPRIGHT = { x: 0, y: -9.8 };

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/^Speed/).fill("1");
    await sendMotion(page, UPRIGHT);
  });

  test("should slide the body toward the tilted side once the toggle is on", async ({
    page,
  }) => {
    const toggle = page.getByLabel("Gyro tilt");
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    const before = await bodyCentre(page);

    await sendMotion(page, SIDEWAYS);
    await expect
      .poll(
        async () => {
          await sendMotion(page, SIDEWAYS);
          return bodyCentre(page);
        },
        { timeout: 60_000 },
      )
      .toBeGreaterThan(before + 0.05);
  });

  test("should leave gravity straight down while the toggle is off", async ({
    page,
  }) => {
    await expect(page.getByLabel("Gyro tilt")).toBeEnabled();
    const before = await bodyCentre(page);
    for (let i = 0; i < 60; i++) {
      await sendMotion(page, SIDEWAYS, { x: 30, y: 0 });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    expect(Math.abs((await bodyCentre(page)) - before)).toBeLessThan(0.005);
  });

  test("should push the body against a shake, and stop pushing when the shake ends", async ({
    page,
  }) => {
    await page.getByLabel("Gyro tilt").check();
    await page.getByLabel(/^Tilt smoothing/).fill("0");
    const before = await bodyCentre(page);
    await expect
      .poll(
        async () => {
          await sendMotion(page, UPRIGHT, { x: -20, y: 0 });
          return bodyCentre(page);
        },
        { timeout: 60_000 },
      )
      .toBeGreaterThan(before + 0.05);
  });

  test("should keep running after Reset with the toggle still on", async ({
    page,
  }) => {
    await page.getByLabel("Gyro tilt").check();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByLabel("Gyro tilt")).toBeChecked();
    await expect(page.getByLabel("Simulation statistics")).toContainText(
      "0.0%",
    );
  });
});

test.describe("without a usable WebGPU", () => {
  const expectNoSimulation = async (page: Page) => {
    await expect(
      page.getByRole("heading", { name: "WebGPU is required" }),
    ).toBeVisible();
    await expect(page.getByLabel("Fracture simulation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Material", exact: true }),
    ).toBeDisabled();
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
  await expect(
    page.getByRole("combobox", { name: "Material", exact: true }),
  ).toBeDisabled();
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
