import { expect, it } from "vitest";

import { SHADERS } from "./shaders";

it("gives every module the shared constants and records ahead of its own code", () => {
  for (const code of Object.values(SHADERS)) {
    expect(code).toContain("const GRAVITY: f32 = 9.8;");
    expect(code.indexOf("struct Node")).toBeGreaterThan(
      code.indexOf("const GRAVITY"),
    );
  }
});

it("declares each pass's entry point", () => {
  expect(SHADERS.elements).toContain("fn elementForces");
  expect(SHADERS.nodes).toContain("fn nodeStep");
  expect(SHADERS.balls).toContain("fn ballStep");
  expect(SHADERS.interact).toContain("fn grabStart");
  expect(SHADERS.interact).toContain("fn blast");
  expect(SHADERS.render).toContain("fn bodyVertex");
});
