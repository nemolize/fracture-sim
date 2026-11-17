import { expect, it } from "vitest";

import { RECORD_BYTES } from "./layout";
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

/** WGSL storage layout of the member types the records use: byte size and alignment. */
const LAYOUT: Record<string, { size: number; align: number }> = {
  f32: { size: 4, align: 4 },
  u32: { size: 4, align: 4 },
  "vec2<f32>": { size: 8, align: 8 },
  "vec3<u32>": { size: 12, align: 16 },
  "vec4<f32>": { size: 16, align: 16 },
};

const roundUp = (value: number, align: number): number =>
  Math.ceil(value / align) * align;

/** Member byte offsets and total size of a WGSL struct under its alignment rules. */
const structLayout = (
  code: string,
  name: string,
): { offsets: Record<string, number>; size: number } => {
  const body = new RegExp(`struct ${name} \\{([^}]*)\\}`).exec(code)?.[1] ?? "";
  const offsets: Record<string, number> = {};
  let end = 0;
  let structAlign = 1;
  for (const [, member = "", type = ""] of body.matchAll(
    /^\s+(\w+): (.+?),$/gm,
  )) {
    const { size, align } = LAYOUT[type] ?? { size: Number.NaN, align: 1 };
    offsets[member] = roundUp(end, align);
    end = (offsets[member] ?? 0) + size;
    structAlign = Math.max(structAlign, align);
  }
  return { offsets, size: roundUp(end, structAlign) };
};

// The word indices `packMesh`, `packBall` and the unpack functions use, times 4.
const RECORD_OFFSETS: Record<string, Record<string, number>> = {
  Node: { pos: 0, vel: 8, grabOffset: 16, grabbed: 24, refs: 28 },
  ElemStatic: { restInverse: 0, tri: 16, area: 28 },
  ElemState: {
    plasticInverse: 0,
    plasticStrain: 16,
    damage: 20,
    stressRatio: 24,
    alive: 28,
  },
  Ball: { pos: 0, vel: 8, radius: 16, mass: 20, pad: 24 },
};

it.each(Object.keys(RECORD_OFFSETS))(
  "lays out the %s record as the TypeScript side packs it",
  (name) => {
    const layout = structLayout(SHADERS.nodes, name);
    expect(layout.size).toBe(RECORD_BYTES);
    expect(layout.offsets).toEqual(RECORD_OFFSETS[name]);
  },
);

it("takes workgroup sizes from the injected constants", () => {
  for (const code of Object.values(SHADERS)) {
    expect(code).not.toMatch(/@workgroup_size\(\d/);
  }
});
