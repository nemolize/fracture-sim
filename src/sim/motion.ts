import { GRAVITY } from "./contact";
import type { Vec2 } from "./vec2";

export interface Axes {
  x: number | null;
  y: number | null;
  z: number | null;
}

export interface MotionReading {
  accelerationIncludingGravity: Axes | null;
  acceleration: Axes | null;
}

export interface MotionSample {
  tilt: number | null;
  acceleration: Vec2 | null;
}

export interface MotionTuning {
  inertiaScale: number;
  inertiaCap: number;
}

/** In-screen share of gravity below which the device counts as lying flat; chosen empirically, no fixed source. */
const FLAT_SHARE = 0.1;
const QUARTER_TURN = Math.PI / 2;
/** Radians either side of upside down where the tilt keeps its side; chosen empirically, no fixed source. */
const FLIP_BAND = 0.2;
/** How long an acceleration sample keeps pushing once events stop; chosen empirically, no fixed source. */
const STALE_MS = 500;

const finite = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

const planar = (axes: Axes | null, sign: number): Vec2 | null =>
  axes !== null && finite(axes.x) && finite(axes.y)
    ? { x: sign * axes.x, y: sign * axes.y }
    : null;

export const toScreenFrame = ({ x, y }: Vec2, angle: number): Vec2 => {
  switch (((Math.round(angle / 90) % 4) + 4) % 4) {
    case 0:
      return { x, y };
    case 1:
      return { x: -y, y: x };
    case 2:
      return { x: -x, y: -y };
    default:
      return { x: y, y: -x };
  }
};

/** Whether the event carries a sensor reading at all, however the device is held. */
export const hasReading = (event: MotionReading): boolean =>
  planar(event.accelerationIncludingGravity, 1) !== null;

/**
 * Reads one `devicemotion` event. `flipped` is true where the browser reports
 * every axis with the opposite sign to the specification (iOS Safari).
 */
export const readMotion = (
  event: MotionReading,
  angle: number,
  flipped: boolean,
): MotionSample => {
  const sign = flipped ? -1 : 1;
  const reaction = planar(event.accelerationIncludingGravity, sign);
  const acceleration = planar(event.acceleration, sign);
  let tilt: number | null = null;
  if (reaction !== null) {
    // The reading is gravity's reaction plus the device's own acceleration; only gravity tilts.
    const own = acceleration ?? { x: 0, y: 0 };
    const gravity = toScreenFrame(
      { x: own.x - reaction.x, y: own.y - reaction.y },
      angle,
    );
    if (Math.hypot(gravity.x, gravity.y) >= FLAT_SHARE * GRAVITY) {
      tilt = Math.atan2(gravity.x, -gravity.y);
    }
  }
  return {
    tilt,
    acceleration:
      acceleration === null ? null : toScreenFrame(acceleration, angle),
  };
};

const blend = (seconds: number, timeConstant: number): number =>
  timeConstant <= 0 ? 1 : 1 - Math.exp(-seconds / timeConstant);

export class MotionTracker {
  private tilt = 0;
  /** Side of the last sample outside the upside-down band, as a sign. */
  private side = 0;
  private acceleration: Vec2 = { x: 0, y: 0 };
  private lastTime: number | null = null;

  /** Takes one sample; `time` is in milliseconds, `smoothing` is the tilt filter's time constant in seconds. */
  update(sample: MotionSample, time: number, smoothing: number): void {
    const seconds =
      this.lastTime === null ? Infinity : (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (sample.tilt !== null) {
      // Noise around upside down keeps the side the samples came from instead of swinging across.
      const upsideDown = Math.abs(sample.tilt) > Math.PI - FLIP_BAND;
      if ((!upsideDown || this.side === 0) && sample.tilt !== 0) {
        this.side = Math.sign(sample.tilt);
      }
      const target = upsideDown
        ? this.side * QUARTER_TURN
        : Math.max(-QUARTER_TURN, Math.min(QUARTER_TURN, sample.tilt));
      this.tilt += (target - this.tilt) * blend(seconds, smoothing);
    }
    this.acceleration = sample.acceleration ?? { x: 0, y: 0 };
  }

  reset(): void {
    this.tilt = 0;
    this.side = 0;
    this.acceleration = { x: 0, y: 0 };
    this.lastTime = null;
  }

  /** Gravity along the tilt plus the inertial push against the device's acceleration. */
  gravity({ inertiaScale, inertiaCap }: MotionTuning, now: number): Vec2 {
    const fresh = this.lastTime !== null && now - this.lastTime <= STALE_MS;
    const push = {
      x: fresh ? -this.acceleration.x * inertiaScale : 0,
      y: fresh ? -this.acceleration.y * inertiaScale : 0,
    };
    const length = Math.hypot(push.x, push.y);
    const limit = length > inertiaCap ? inertiaCap / length : 1;
    return {
      x: GRAVITY * Math.sin(this.tilt) + push.x * limit,
      y: -GRAVITY * Math.cos(this.tilt) + push.y * limit,
    };
  }
}
