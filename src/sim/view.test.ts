import { describe, expect, it } from "vitest";

import { VIEW_MODES, viewId } from "./view";

describe("viewId", () => {
  it("numbers the modes in list order", () => {
    expect(VIEW_MODES.map(viewId)).toEqual([0, 1, 2, 3, 4]);
  });
});
