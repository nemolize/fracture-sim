import { expect, test } from "@playwright/test";

test.use({ deviceScaleFactor: 2 });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]) {
  test(`scale bar matches physical metres at viewport width ${String(viewport.width)}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const canvas = page.getByLabel("Fracture simulation");
    const reference = page.getByRole("group", {
      name: "World scale reference",
    });
    for (const { scale, metres } of [
      { scale: 0.6, metres: 1 },
      { scale: 1, metres: 2 },
      { scale: 3, metres: 5 },
    ]) {
      await page
        .getByRole("slider", { name: "World scale", exact: true })
        .evaluate((input, value) => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set?.call(input, String(value));
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }, scale);
      await canvas.scrollIntoViewIfNeeded();
      await expect(reference).toHaveText(
        `${String(metres)} m · ×${scale.toFixed(1)}`,
      );
      const bar = page.getByRole("img", {
        name: `${String(metres)} m scale bar`,
      });
      const worldBox = await canvas.boundingBox();
      const barBox = await bar.boundingBox();
      // eslint-disable-next-line playwright/no-conditional-in-test -- Bounding boxes are nullable in Playwright.
      if (worldBox === null || barBox === null)
        throw new Error("Missing scale geometry");
      expect(barBox.width).toBeCloseTo(
        (worldBox.width * metres) / (10 * scale),
        1,
      );
      expect(barBox.x + barBox.width).toBeCloseTo(
        worldBox.x + worldBox.width - 12,
        1,
      );
      expect(barBox.y).toBeGreaterThan(worldBox.y);
      expect(barBox.y + barBox.height).toBeLessThan(
        worldBox.y + worldBox.height,
      );
      expect(
        await bar.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return document
            .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            ?.getAttribute("aria-label");
        }),
      ).toBe("Fracture simulation");
    }
    await canvas.locator("..").screenshot({
      path: `test-results/scale-reference-${String(viewport.width)}.png`,
    });
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}
