import type { Vec2 } from "@/sim/vec2";

export interface ContactMotion {
  before: number;
  after: number;
  inverseMass: number;
}

export interface BodyMotion {
  velocity: Vec2;
  angularVelocity: number;
}

export const contactMotion = (
  motion: BodyMotion,
  after: BodyMotion,
  lever: Vec2,
  normal: Vec2,
  inverseMass: number,
  inverseInertia: number,
): ContactMotion => {
  const arm = lever.x * normal.y - lever.y * normal.x;
  return {
    before:
      motion.velocity.x * normal.x +
      motion.velocity.y * normal.y +
      motion.angularVelocity * arm,
    after:
      after.velocity.x * normal.x +
      after.velocity.y * normal.y +
      after.angularVelocity * arm,
    inverseMass: inverseMass + arm * arm * inverseInertia,
  };
};

export const impactEnergy = (
  a: ContactMotion,
  b: ContactMotion,
): readonly [number, number] => {
  const inverseMass = a.inverseMass + b.inverseMass;
  const closing = a.before - b.before;
  if (!(closing > 0) || !(inverseMass > 0)) return [0, 0];
  const after = b.after - a.after;
  const loss = Math.max(
    0,
    (closing * closing - after * after) / (2 * inverseMass),
  );
  return [
    (loss * a.inverseMass) / inverseMass,
    (loss * b.inverseMass) / inverseMass,
  ];
};
