import { describe, expect, it, vi } from "vitest";

import { type DrawContext, drawWorld } from "./draw";
import { VIEW_MODES } from "./view";
import { World } from "./world";

const fakeContext = () => {
  const fills: unknown[] = [];
  const ctx: DrawContext = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(() => {
      fills.push(ctx.fillStyle);
    }),
    fillRect: vi.fn(),
    fillStyle: "",
    lineJoin: "miter",
    lineTo: vi.fn(),
    lineWidth: 1,
    moveTo: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: "",
  };
  return { ctx, fills };
};

describe("drawWorld", () => {
  it.each(VIEW_MODES)("fills every live triangle in the %s view", (view) => {
    const world = new World({ scene: "tower", material: "steel" });
    const { ctx, fills } = fakeContext();
    drawWorld(ctx, world, view, 1000, 560, { aim: null });
    expect(fills).toHaveLength(world.triCount);
    expect(
      fills.every((color) => typeof color === "string" && color !== ""),
    ).toBe(true);
  });

  it("skips eroded triangles", () => {
    const world = new World({ scene: "tower", material: "steel" });
    world.alive[0] = 0;
    world.chunkOf[0] = -1;
    const { ctx, fills } = fakeContext();
    drawWorld(ctx, world, "chunks", 1000, 560, { aim: null });
    expect(fills).toHaveLength(world.triCount - 1);
  });

  it("draws balls and the aiming line", () => {
    const world = new World({ scene: "wall", material: "glass" });
    world.throwBall(1, 1, 0, 0);
    const { ctx } = fakeContext();
    drawWorld(ctx, world, "material", 1000, 560, {
      aim: { x0: 1, y0: 1, x1: 2, y1: 1.5 },
    });
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    // The last stroke is the aiming line.
    expect(ctx.strokeStyle).toBe("#dc2626");
  });
});
