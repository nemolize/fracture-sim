import { expect, it } from "vitest";

import { asScene } from "./settings";
it("narrows scene selections", () => {
  expect(asScene("pile")).toBe("pile");
  expect(asScene("unknown")).toBeUndefined();
});
