import { expect, it, vi } from "vitest";

import { PointerGesture } from "./gesture";
import { limitVelocity } from "./tools";

const sample = (x: number, y: number, time: number, id = 1) => ({
  id,
  point: { x, y },
  time,
});

it("grabs, follows the pointer and releases with its last velocity", () => {
  const send = vi.fn();
  const gesture = new PointerGesture(send);
  expect(gesture.down("grab", sample(1, 1, 0))).toBe(true);
  gesture.move(sample(1, 3, 200));
  gesture.up(sample(1, 3, 220));
  expect(send.mock.calls).toEqual([
    [{ type: "grab", point: { x: 1, y: 1 } }],
    [{ type: "move", point: { x: 1, y: 3 } }],
    [{ type: "move", point: { x: 1, y: 3 } }],
    [{ type: "release", velocity: { x: 0, y: 10 } }],
  ]);
});

it("drops without a fling after the pointer rests or capture is cancelled", () => {
  const send = vi.fn();
  const gesture = new PointerGesture(send);
  gesture.down("grab", sample(1, 1, 0));
  gesture.move(sample(2, 1, 100));
  gesture.up(sample(2, 1, 400));
  expect(send).toHaveBeenLastCalledWith({
    type: "release",
    velocity: { x: 0, y: 0 },
  });
  gesture.down("grab", sample(1, 1, 500));
  gesture.cancel();
  gesture.cancel();
  expect(send).toHaveBeenLastCalledWith({
    type: "release",
    velocity: { x: 0, y: 0 },
  });
});

it("ignores unrelated pointers and nonpositive event intervals", () => {
  const send = vi.fn();
  const gesture = new PointerGesture(send);
  gesture.move(sample(1, 1, 0));
  gesture.up(sample(1, 1, 0));
  expect(gesture.down("grab", sample(1, 1, 0))).toBe(true);
  expect(gesture.down("throw", sample(1, 1, 0, 2))).toBe(false);
  gesture.move(sample(2, 1, 100, 2));
  gesture.up(sample(2, 1, 100, 2));
  gesture.cancel(2);
  expect(send).toHaveBeenCalledTimes(1);
  gesture.move(sample(2, 1, 0));
  gesture.up(sample(2, 1, 0));
  expect(send).toHaveBeenLastCalledWith({
    type: "release",
    velocity: { x: 0, y: 0 },
  });
});

it("launches along the drag and cancels aiming without launching", () => {
  const send = vi.fn();
  const gesture = new PointerGesture(send);
  gesture.down("throw", sample(1, 1, 0));
  gesture.move(sample(4, 1, 100));
  gesture.up(sample(4, 1, 110));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "throw",
    point: { x: 1, y: 1 },
    velocity: { x: 12, y: 0 },
  });
  gesture.down("throw", sample(1, 1, 200));
  gesture.cancel();
  expect(send).toHaveBeenCalledTimes(1);
  expect(limitVelocity({ x: 30, y: 40 })).toEqual({ x: 15, y: 20 });
});

it("blasts immediately without retaining an active gesture", () => {
  const send = vi.fn();
  const gesture = new PointerGesture(send);
  expect(gesture.down("blast", sample(1, 1, 0))).toBe(false);
  gesture.cancel();
  gesture.up(sample(1, 1, 0));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: "blast",
    point: { x: 1, y: 1 },
  });
});

it("measures a flick after a stationary hold from the latest sampled interval", () => {
  const send = vi.fn();
  const gesture = new PointerGesture(send);
  gesture.down("grab", sample(1, 1, 0));
  gesture.move(sample(2, 1, 100));
  gesture.move(sample(2, 1, 1000));
  gesture.move(sample(3, 1, 1100));
  gesture.up(sample(3, 1, 1110));
  expect(send).toHaveBeenLastCalledWith({
    type: "release",
    velocity: { x: 10, y: 0 },
  });
});
