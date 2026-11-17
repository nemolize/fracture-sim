/** One scripted interaction, applied just before step number `at`. */
export type Op =
  | { at: number; kind: "throw"; x: number; y: number; vx: number; vy: number }
  | {
      at: number;
      kind: "blast" | "grab" | "move" | "gravity";
      x: number;
      y: number;
    }
  | { at: number; kind: "release" };

/** What a solver offers a script: the CPU reference and the GPU solver both fit. */
export interface Steppable {
  step: (count: number) => void;
  throwBall: (x: number, y: number, vx: number, vy: number) => void;
  blast: (x: number, y: number) => void;
  startGrab: (x: number, y: number) => void;
  moveGrab: (x: number, y: number) => void;
  endGrab: () => void;
  setGravity: (x: number, y: number) => void;
}

const apply = (target: Steppable, op: Op): void => {
  switch (op.kind) {
    case "throw":
      target.throwBall(op.x, op.y, op.vx, op.vy);
      break;
    case "blast":
      target.blast(op.x, op.y);
      break;
    case "grab":
      target.startGrab(op.x, op.y);
      break;
    case "move":
      target.moveGrab(op.x, op.y);
      break;
    case "gravity":
      target.setGravity(op.x, op.y);
      break;
    case "release":
      target.endGrab();
      break;
  }
};

/** Runs `steps` steps, applying each op between the steps its `at` names. */
export const runScript = (
  target: Steppable,
  ops: readonly Op[],
  steps: number,
): void => {
  const ordered = [...ops].sort((a, b) => a.at - b.at);
  let done = 0;
  for (const op of ordered) {
    const upTo = Math.min(op.at, steps);
    target.step(upTo - done);
    done = upTo;
    apply(target, op);
  }
  target.step(steps - done);
};
