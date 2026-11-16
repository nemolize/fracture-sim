import { expect, it } from "vitest";

import { labelChunks } from "./chunks";

it("labels disjoint triangles as separate pieces and marks eroded ones", () => {
  // Triangles 0 and 1 share node 1; triangle 2 is separate; triangle 3 is eroded.
  const tri = new Int32Array([0, 1, 2, 1, 3, 2, 4, 5, 6, 0, 2, 3]);
  const alive = new Uint8Array([1, 1, 1, 0]);
  const labels = new Int32Array(4);
  const count = labelChunks(tri, alive, 7, labels);
  expect(count).toBe(2);
  expect(labels[0]).toBe(labels[1]);
  expect(labels[2]).not.toBe(labels[0]);
  expect(labels[3]).toBe(-1);
});

it("counts zero pieces when everything is eroded", () => {
  expect(
    labelChunks(
      new Int32Array([0, 1, 2]),
      new Uint8Array([0]),
      3,
      new Int32Array(1),
    ),
  ).toBe(0);
});
