/** Longest real frame the clock accepts, so a background tab does not trigger a burst of steps. */
export const MAX_FRAME_SECONDS = 0.05;
/** Upper bound on solver steps per frame; the simulation slows down rather than freezing the page. */
export const MAX_STEPS_PER_FRAME = 120;

export interface FramePlan {
  steps: number;
  /** Simulated time carried over to the next frame. */
  clock: number;
  /** True when the cap cut the frame short, so the simulation fell behind real time. */
  capped: boolean;
}

/** How many fixed steps to run this frame to keep up with `speed` simulated seconds per real second. */
export const planFrame = (
  clock: number,
  elapsedSeconds: number,
  speed: number,
  dt: number,
): FramePlan => {
  const owed = clock + Math.min(elapsedSeconds, MAX_FRAME_SECONDS) * speed;
  const wanted = Math.floor(owed / dt);
  if (wanted > MAX_STEPS_PER_FRAME) {
    return { steps: MAX_STEPS_PER_FRAME, clock: 0, capped: true };
  }
  return { steps: wanted, clock: owed - wanted * dt, capped: false };
};
