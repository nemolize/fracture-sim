import { expect, it } from "vitest";

import { BufferUsage } from "./usage";
it("uses the WebGPU buffer flags", () => {
  expect(BufferUsage).toEqual({
    COPY_DST: 8,
    VERTEX: 32,
    UNIFORM: 64,
    STORAGE: 128,
  });
});
