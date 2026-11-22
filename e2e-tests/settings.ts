import { expect, type Page } from "@playwright/test";

/** The settings live in a popup that the Settings button toggles. */
export const openSettings = async (page: Page): Promise<void> => {
  const toggle = page.getByRole("button", { name: "Settings", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
};

export const closeSettings = async (page: Page): Promise<void> => {
  const toggle = page.getByRole("button", { name: "Settings", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) === "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
};

export const useWidePlate = async (page: Page): Promise<void> => {
  await openSettings(page);
  for (const [name, value] of [
    ["Object width (m)", 2],
    ["Object height (m)", 1],
  ] as const)
    await page
      .getByRole("slider", { name, exact: true })
      .evaluate((input, next) => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(input, String(next));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
  await closeSettings(page);
};
