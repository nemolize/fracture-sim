import { expect, it } from "vitest";

import { BufferUsage, MapMode, ShaderStage, TextureUsage } from "./usage";

it.each([BufferUsage, ShaderStage, MapMode, TextureUsage])(
  "gives each flag its own bit so flags can be or-ed together",
  (flags) => {
    const values = Object.values(flags);
    expect(values.every((v) => v > 0 && (v & (v - 1)) === 0)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  },
);
