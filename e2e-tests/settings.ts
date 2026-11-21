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
