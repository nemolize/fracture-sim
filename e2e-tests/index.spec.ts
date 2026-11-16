import { expect, test } from "@playwright/test";

import { isPreviewTarget } from "./target";

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
