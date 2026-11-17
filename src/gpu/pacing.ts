/** Longest real frame the clock accepts, so a background tab does not trigger a burst of steps. */
export const MAX_FRAME_SECONDS = 0.05;
/** Upper bound on simulated time per frame; the simulation slows down rather than freezing the page. */
export const MAX_SIM_SECONDS_PER_FRAME = 0.036;

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
  const cap = Math.floor(MAX_SIM_SECONDS_PER_FRAME / dt);
  if (wanted > cap) return { steps: cap, clock: 0, capped: true };
  return { steps: wanted, clock: owed - wanted * dt, capped: false };
};

/** Real time of frames skipped while the GPU was busy, owed to the next frame that runs. */
export class SkippedTime {
  private seconds = 0;

  /** Seconds of real time the frame owes, or null when it is skipped and its time is kept for later. */
  take(elapsedSeconds: number, busy: boolean): number | null {
    if (busy) {
      this.seconds += elapsedSeconds;
      return null;
    }
    const owed = elapsedSeconds + this.seconds;
    this.seconds = 0;
    return owed;
  }
}
