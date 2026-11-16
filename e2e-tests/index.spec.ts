import { expect, test } from "@playwright/test";

import { isPreviewTarget } from "./target";

test("should load the counter demo page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Web App Template");

  await expect(
    page.getByRole("heading", { name: "Counter Demo" }),
  ).toBeVisible();

  const decrementButton = page.getByRole("button", {
    name: "Decrement count",
  });
  const incrementButton = page.getByRole("button", {
    name: "Increment count",
  });

  await expect(decrementButton).toBeVisible();
  await expect(incrementButton).toBeVisible();

  const count = page.getByRole("status", { name: "Current count" });
  await expect(count).toHaveText("0");
  await incrementButton.click();
  await expect(count).toHaveText("1");
  await decrementButton.click();
  await expect(count).toHaveText("0");
});

test("should serve the SPA shell for a deep route with no file on disk", async ({
  page,
}) => {
  await page.goto("/some/deep/route");

  await expect(page).toHaveTitle("Web App Template");
  await expect(
    page.getByRole("heading", { name: "Counter Demo" }),
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

  await expect(page.getByRole("heading", { name: "Counter Demo" })).toHaveCSS(
    "font-size",
    "36px",
  );
});
