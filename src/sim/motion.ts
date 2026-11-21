import { GRAVITY } from "@/rigid/constants";

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

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MotionSample {
  gravity: Vec3 | null;
  acceleration: Vec2 | null;
}

export interface MotionTuning {
  gravity?: number;
  inertiaScale: number;
  inertiaCap: number;
}

/** How long an acceleration sample keeps pushing once events stop; chosen empirically, no fixed source. */
const STALE_MS = 500;

const finite = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

const spatial = (axes: Axes | null, sign: number): Vec3 | null =>
  axes !== null && finite(axes.x) && finite(axes.y)
    ? {
        x: sign * axes.x,
        y: sign * axes.y,
        z: finite(axes.z) ? sign * axes.z : 0,
      }
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

export const hasReading = (event: MotionReading): boolean =>
  spatial(event.accelerationIncludingGravity, 1) !== null;

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
  const reaction = spatial(event.accelerationIncludingGravity, sign);
  const own = spatial(event.acceleration, sign);
  let gravity: Vec3 | null = null;
  if (reaction !== null) {
    const vector = {
      x: (own?.x ?? 0) - reaction.x,
      y: (own?.y ?? 0) - reaction.y,
      z: (own?.z ?? 0) - reaction.z,
    };
    gravity = spatial({ ...toScreenFrame(vector, angle), z: vector.z }, 1);
  }
  return {
    gravity,
    acceleration: own === null ? null : toScreenFrame(own, angle),
  };
};

const blend = (seconds: number, timeConstant: number): number =>
  timeConstant <= 0 ? 1 : 1 - Math.exp(-seconds / timeConstant);

export class MotionTracker {
  private gravityVector: Vec3 = { x: 0, y: -GRAVITY, z: 0 };
  private acceleration: Vec2 = { x: 0, y: 0 };
  private lastTime: number | null = null;

  /** Takes one sample; `time` is in milliseconds, `smoothing` is the tilt filter's time constant in seconds. */
  update(sample: MotionSample, time: number, smoothing: number): void {
    const seconds =
      this.lastTime === null ? Infinity : (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (sample.gravity !== null) {
      const weight = blend(seconds, smoothing);
      this.gravityVector = {
        x:
          this.gravityVector.x +
          (sample.gravity.x - this.gravityVector.x) * weight,
        y:
          this.gravityVector.y +
          (sample.gravity.y - this.gravityVector.y) * weight,
        z:
          this.gravityVector.z +
          (sample.gravity.z - this.gravityVector.z) * weight,
      };
    }
    this.acceleration = sample.acceleration ?? { x: 0, y: 0 };
  }

  reset(): void {
    this.gravityVector = { x: 0, y: -GRAVITY, z: 0 };
    this.acceleration = { x: 0, y: 0 };
    this.lastTime = null;
  }

  /** Screen-plane gravity plus inertial push against the device's acceleration. */
  gravity(
    { inertiaScale, inertiaCap, gravity = GRAVITY }: MotionTuning,
    now: number,
  ): Vec2 {
    const fresh = this.lastTime !== null && now - this.lastTime <= STALE_MS;
    const push = {
      x: fresh ? -this.acceleration.x * inertiaScale : 0,
      y: fresh ? -this.acceleration.y * inertiaScale : 0,
    };
    const length = Math.hypot(push.x, push.y);
    const limit = length > inertiaCap ? inertiaCap / length : 1;
    return {
      x: this.gravityVector.x * (gravity / GRAVITY) + push.x * limit,
      y: this.gravityVector.y * (gravity / GRAVITY) + push.y * limit,
    };
  }
}
