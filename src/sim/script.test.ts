import { expect, it } from "vitest";

import { type Op, runScript } from "./script";

const recorder = () => {
  const log: string[] = [];
  return {
    log,
    target: {
      step: (count: number) => {
        if (count > 0) log.push(`step ${String(count)}`);
      },
      throwBall: (x: number, y: number, vx: number, vy: number) => {
        log.push(`throw ${[x, y, vx, vy].join(",")}`);
      },
      blast: (x: number, y: number) => {
        log.push(`blast ${String(x)},${String(y)}`);
      },
      startGrab: (x: number, y: number) => {
        log.push(`grab ${String(x)},${String(y)}`);
      },
      moveGrab: (x: number, y: number) => {
        log.push(`move ${String(x)},${String(y)}`);
      },
      endGrab: () => {
        log.push("release");
      },
    },
  };
};

it("applies each op between the steps its position names, in order", () => {
  const { log, target } = recorder();
  const ops: Op[] = [
    { at: 30, kind: "release" },
    { at: 10, kind: "throw", x: 1, y: 2, vx: 3, vy: 4 },
    { at: 10, kind: "blast", x: 5, y: 6 },
    { at: 20, kind: "grab", x: 7, y: 8 },
    { at: 25, kind: "move", x: 9, y: 0 },
  ];
  runScript(target, ops, 40);
  expect(log).toEqual([
    "step 10",
    "throw 1,2,3,4",
    "blast 5,6",
    "step 10",
    "grab 7,8",
    "step 5",
    "move 9,0",
    "step 5",
    "release",
    "step 10",
  ]);
});

it("applies ops past the end at the end", () => {
  const { log, target } = recorder();
  runScript(target, [{ at: 99, kind: "release" }], 5);
  expect(log).toEqual(["step 5", "release"]);
});
