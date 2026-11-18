import { describe, expect, it } from "vitest";

import { percentile, runsOnShared } from "./timing";

describe("percentile", () => {
  it("takes the 950th of 1,000 sorted samples as p95", () => {
    const samples = Array.from({ length: 1000 }, (_, i) => 1000 - i);
    expect(percentile(samples, 0.95)).toBe(950);
  });

  it("clamps to the last sample", () => {
    expect(percentile([3, 1, 2], 1)).toBe(3);
  });
});

describe("runsOnShared", () => {
  it("is true when CI is set", () => {
    expect(runsOnShared({ CI: "true" })).toBe(true);
  });

  it("is false when CI is unset or empty", () => {
    expect(runsOnShared({})).toBe(false);
    expect(runsOnShared({ CI: "" })).toBe(false);
  });
});
