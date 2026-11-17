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
    const gravity = toScreenFrame({ x: -reaction.x, y: -reaction.y }, angle);
    if (Math.hypot(gravity.x, gravity.y) >= FLAT_SHARE * GRAVITY) {
      const raw = Math.atan2(gravity.x, -gravity.y);
      tilt = Math.max(-QUARTER_TURN, Math.min(QUARTER_TURN, raw));
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
  private acceleration: Vec2 = { x: 0, y: 0 };
  private lastTime: number | null = null;

  /** Takes one sample; `time` is in milliseconds, `smoothing` is the tilt filter's time constant in seconds. */
  update(sample: MotionSample, time: number, smoothing: number): void {
    const seconds =
      this.lastTime === null ? Infinity : (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (sample.tilt !== null) {
      this.tilt += (sample.tilt - this.tilt) * blend(seconds, smoothing);
    }
    this.acceleration = sample.acceleration ?? { x: 0, y: 0 };
  }

  reset(): void {
    this.tilt = 0;
    this.acceleration = { x: 0, y: 0 };
    this.lastTime = null;
  }

  /** Gravity along the tilt plus the inertial push against the device's acceleration. */
  gravity({ inertiaScale, inertiaCap }: MotionTuning): Vec2 {
    const push = {
      x: -this.acceleration.x * inertiaScale,
      y: -this.acceleration.y * inertiaScale,
    };
    const length = Math.hypot(push.x, push.y);
    const limit = length > inertiaCap ? inertiaCap / length : 1;
    return {
      x: GRAVITY * Math.sin(this.tilt) + push.x * limit,
      y: -GRAVITY * Math.cos(this.tilt) + push.y * limit,
    };
  }
}
