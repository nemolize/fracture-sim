import { expect, it } from "vitest";

import { asScene, DEFAULT_SETTINGS, resetParameters } from "./settings";
it("narrows scene selections", () => {
  expect(asScene("pile")).toBe("pile");
  expect(asScene("unknown")).toBeUndefined();
});

it("resets parameters but keeps the scene and tool", () => {
  expect(
    resetParameters({
      ...DEFAULT_SETTINGS,
      scene: "pile",
      tool: "throw",
      inertiaCap: 1,
    }),
  ).toEqual({ ...DEFAULT_SETTINGS, scene: "pile", tool: "throw" });
});
