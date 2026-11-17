import { describe, expect, it } from "vitest";

import { f32Literal, wgslConstants } from "./constants";

describe("f32Literal", () => {
  it.each([
    [20000, "20000.0"],
    [0.6, "0.6"],
    [1e-4, "0.0001"],
    [1e-7, "1e-7"],
    [2e21, "2e+21"],
  ])("writes %s as %s", (value, text) => {
    expect(f32Literal(value)).toBe(text);
  });
});

describe("wgslConstants", () => {
  const source = wgslConstants();

  it("takes its numbers from the TypeScript constants", () => {
    expect(source).toContain("const GRAVITY: f32 = 9.8;");
    expect(source).toContain("const CONTACT_STIFFNESS: f32 = 20000.0;");
    expect(source).toContain("const MAX_BALLS: u32 = 8u;");
  });

  it("numbers the view modes in list order", () => {
    expect(source).toContain("const VIEW_MATERIAL: u32 = 0u;");
    expect(source).toContain("const VIEW_CHUNKS: u32 = 4u;");
  });
});
