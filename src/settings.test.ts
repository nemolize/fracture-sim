import { expect, it } from "vitest";

import { DEFAULT_SETTINGS, resetParameters } from "./settings";

it("resets parameters but keeps the tool", () => {
  expect(
    resetParameters({
      ...DEFAULT_SETTINGS,
      tool: "throw",
      inertiaCap: 1,
    }),
  ).toEqual({ ...DEFAULT_SETTINGS, tool: "throw" });
});
