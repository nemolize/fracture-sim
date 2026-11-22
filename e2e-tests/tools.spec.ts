import { expect, type Page, test } from "@playwright/test";

import type { Snapshot, WorkerResponse } from "../src/rigid/types";
import { observeCrackEnergy, selectCustomMaterial } from "./material-fixture";
import { closeSettings, openSettings } from "./settings";

declare global {
  interface Window {
    observedPhysics?: Snapshot;
    plateMaxSpeed: number;
  }
}

const observeWorker = (page: Page) =>
  page.addInitScript(() => {
    window.plateMaxSpeed = 0;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener(
          "message",
          (event: MessageEvent<WorkerResponse>) => {
            if (event.data.type !== "error") {
              const previous = window.observedPhysics;
              const next = event.data.snapshot;
              if (
                previous !== undefined &&
                next.stats.time > previous.stats.time
              ) {
                const vx =
                  Math.abs(
                    (next.poses[16] ?? NaN) - (previous.poses[16] ?? NaN),
                  ) /
                  (next.stats.time - previous.stats.time);
                window.plateMaxSpeed = Math.max(window.plateMaxSpeed, vx);
              }
              window.observedPhysics = next;
            }
          },
        );
      }
    };
  });
const bodyY = (page: Page) =>
  page.evaluate(() => window.observedPhysics?.poses[17] ?? NaN);
const bodyX = (page: Page) =>
  page.evaluate(() => window.observedPhysics?.poses[16] ?? NaN);
const point = async (page: Page, x: number, y: number) => {
  await page.getByLabel("Fracture simulation").scrollIntoViewIfNeeded();
  const box = await page.getByLabel("Fracture simulation").boundingBox();
  if (box === null) throw new Error("Canvas missing");
  const scale = box.width / 10;
  return { x: box.x + x * scale, y: box.y + box.height - (y + 0.4) * scale };
};
const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
};

test.beforeEach(async ({ page }) => {
  await observeCrackEnergy(page);
  await observeWorker(page);
  await page.goto("/");
  await selectCustomMaterial(page);
  await expect
    .poll(() => page.evaluate(() => window.observedPhysics?.stats.sleeping))
    .toBe(1);
});

test("grabs a body, lifts it 2 m and releases it to fall", async ({ page }) => {
  const from = await point(page, 5, 0.5);
  const to = await point(page, 5, 2.5);
  await drag(page, from, to);
  await expect
    .poll(async () => Math.abs((await bodyY(page)) - 2.5))
    .toBeLessThan(0.2);
  await page.screenshot({ path: "test-results/grab-held.png" });
  await page.mouse.up();
  await expect.poll(() => bodyY(page)).toBeLessThan(0.7);
});

const visibleWorldTop = async (page: Page) => {
  const box = await page.getByLabel("Fracture simulation").boundingBox();
  if (box === null) throw new Error("Canvas missing");
  return (box.height / box.width) * 10 - 0.4;
};

for (const viewport of [
  { name: "tall desktop", width: 1280, height: 1400 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`lifts a body to the top of the ${viewport.name} canvas`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const visibleTop = () => visibleWorldTop(page);
    await expect.poll(visibleTop).toBeGreaterThan(5.8);
    const target = (await visibleTop()) - 0.7;
    await drag(page, await point(page, 5, 0.5), await point(page, 5, target));
    await expect
      .poll(async () => Math.abs((await bodyY(page)) - target))
      .toBeLessThan(0.3);
    await page.mouse.up();
  });
}

test("release preserves pointer velocity and a cancelled grab stops following", async ({
  page,
}) => {
  await drag(page, await point(page, 5, 0.5), await point(page, 5, 2.5));
  await expect
    .poll(async () => Math.abs((await bodyY(page)) - 2.5))
    .toBeLessThan(0.2);
  const to = await point(page, 5.7, 2.5);
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => bodyX(page)).toBeGreaterThan(6);
  await openSettings(page);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(() => bodyX(page)).toBeCloseTo(5, 1);
  await expect.poll(() => bodyY(page)).toBeLessThan(0.7);
  await drag(page, await point(page, 5, 0.5), await point(page, 5, 2.5));
  await expect.poll(() => bodyY(page)).toBeGreaterThan(2.3);
  await page
    .getByLabel("Fracture simulation")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect.poll(() => bodyY(page)).toBeLessThan(0.7);
});

test("throw tool launches a visible ball that hits the plate", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await openSettings(page);
  await page
    .getByRole("combobox", { name: "Fracture preset" })
    .selectOption("glass");
  await page.getByLabel("Throw ball").check();
  await closeSettings(page);
  await page.screenshot({
    path: "test-results/fracture-before.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    window.plateMaxSpeed = 0;
  });
  await drag(page, await point(page, 1, 0.6), await point(page, 5, 0.6));
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.observedPhysics?.stats.bodies))
    .toBeGreaterThan(2);
  await expect
    .poll(() => page.evaluate(() => window.plateMaxSpeed))
    .toBeGreaterThan(0.01);
  expect(
    await page.evaluate(() => window.observedPhysics?.stats.mass),
  ).toBeCloseTo(52, 12);
  const hitTime = await page.evaluate(
    () => window.observedPhysics?.stats.time ?? Infinity,
  );
  await expect
    .poll(() => page.evaluate(() => window.observedPhysics?.stats.time ?? 0))
    .toBeGreaterThan(hitTime + 0.8);
  await openSettings(page);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.screenshot({ path: "test-results/throw-hit.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("blast tool pushes nearby bodies away", async ({ page }) => {
  await openSettings(page);
  await page.getByLabel("Blast", { exact: true }).check();
  await closeSettings(page);
  const location = await point(page, 4, 0.5);
  await page.mouse.click(location.x, location.y);
  await expect.poll(() => bodyX(page)).toBeGreaterThan(5.1);
});

test("worker blast leaves a distant body below 1 cm per second", async ({
  page,
}) => {
  await page.goto("/harness.html");
  const measured = await page.evaluate(async () => {
    await window.harness.reset("plate");
    await window.harness.action({
      type: "throw",
      point: { x: 8, y: 2.5 },
      velocity: { x: 0, y: 0 },
    });
    const before = await window.harness.action({
      type: "blast",
      point: { x: 4, y: 0.5 },
    });
    const after = await window.harness.step(1 / 60, { x: 0, y: 0 });
    if (before.type !== "edited" || after.type !== "frame")
      throw new Error("Worker failed");
    return {
      nearSpeed:
        ((after.snapshot.poses[16] ?? NaN) -
          (before.snapshot.poses[16] ?? NaN)) *
        60,
      farSpeed:
        Math.hypot(
          (after.snapshot.poses[20] ?? NaN) -
            (before.snapshot.poses[20] ?? NaN),
          (after.snapshot.poses[21] ?? NaN) -
            (before.snapshot.poses[21] ?? NaN),
        ) * 60,
    };
  });
  expect(measured.nearSpeed).toBeGreaterThan(0);
  expect(measured.farSpeed).toBeLessThan(0.01);
});

test("worker release carries the given velocity after a 2 m lift", async ({
  page,
}) => {
  await page.goto("/harness.html");
  const measured = await page.evaluate(async () => {
    await window.harness.reset("plate");
    await window.harness.action({ type: "grab", point: { x: 5, y: 0.5 } });
    await window.harness.action({ type: "move", point: { x: 5, y: 2.5 } });
    for (let i = 0; i < 20; i++) await window.harness.step(0.1);
    const before = await window.harness.action({
      type: "release",
      velocity: { x: 3, y: 1 },
    });
    const after = await window.harness.step(1 / 60, { x: 0, y: 0 });
    if (before.type !== "edited" || after.type !== "frame")
      throw new Error("Worker failed");
    return {
      xSpeed:
        ((after.snapshot.poses[16] ?? NaN) -
          (before.snapshot.poses[16] ?? NaN)) *
        60,
      ySpeed:
        ((after.snapshot.poses[17] ?? NaN) -
          (before.snapshot.poses[17] ?? NaN)) *
        60,
    };
  });
  expect(measured.xSpeed).toBeCloseTo(3, 2);
  expect(measured.ySpeed).toBeCloseTo(1, 2);
});

test("captured drags below the canvas cannot pull the plate through the floor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await drag(page, await point(page, 5, 0.5), await point(page, 5, -3));
  const start = await page.evaluate(
    () => window.observedPhysics?.stats.time ?? 0,
  );
  await expect
    .poll(() => page.evaluate(() => window.observedPhysics?.stats.time ?? 0))
    .toBeGreaterThan(start + 0.5);
  expect(await bodyY(page)).toBeGreaterThan(0.45);
  await page.mouse.up();
});
