import { expect, test } from "@playwright/test";

import { closeSettings, openSettings } from "./settings";

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
    await openSettings(page);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const canvas = page.getByLabel("Fracture simulation");
    const reference = page.getByRole("group", {
      name: "World scale reference",
    });
    const widths: number[] = [];
    for (const { scale, metres } of [
      { scale: 0.1, metres: 0.1 },
      { scale: 0.6, metres: 0.6 },
      { scale: 1, metres: 1 },
      { scale: 3, metres: 3 },
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
      await closeSettings(page);
      await canvas.scrollIntoViewIfNeeded();
      await expect(reference).toHaveText(`${String(metres)} m`);
      const bar = page.getByRole("img", {
        name: `${String(metres)} m scale bar`,
      });
      await bar.scrollIntoViewIfNeeded();
      const worldBox = await canvas.boundingBox();
      const barBox = await bar.boundingBox();
      // eslint-disable-next-line playwright/no-conditional-in-test -- Bounding boxes are nullable in Playwright.
      if (worldBox === null || barBox === null)
        throw new Error("Missing scale geometry");
      widths.push(barBox.width);
      expect(
        await bar.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            top: style.borderTopWidth,
            bottom: style.borderBottomWidth,
            left: style.borderLeftWidth,
            right: style.borderRightWidth,
          };
        }),
      ).toEqual({ top: "0px", bottom: "2px", left: "2px", right: "2px" });
      expect(barBox.width).toBeCloseTo(
        (worldBox.width * metres) / (10 * scale),
        1,
      );
      expect(barBox.x).toBeCloseTo(worldBox.x + 12, 1);
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
      await openSettings(page);
    }
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.05);
    await canvas.locator("..").screenshot({
      path: `test-results/scale-reference-${String(viewport.width)}.png`,
    });
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}
