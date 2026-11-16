import { expect, it } from "vitest";

import { asMaterial, asScene, asView } from "./settings";

it("narrows known values and rejects unknown ones", () => {
  expect(asScene("tower")).toBe("tower");
  expect(asScene("moon")).toBeUndefined();
  expect(asMaterial("glass")).toBe("glass");
  expect(asMaterial("wood")).toBeUndefined();
  expect(asView("damage")).toBe("damage");
  expect(asView("x")).toBeUndefined();
});
