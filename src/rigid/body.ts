import RAPIER from "@dimforge/rapier2d-compat";

import type { Vec2 } from "@/sim/vec2";

export interface BodyShape {
  body: RAPIER.RigidBody;
  polygon: readonly (readonly [number, number])[];
  domain: readonly Vec2[];
  mass: number;
  fixed: boolean;
  ball: boolean;
}

export const polygonCollider = (
  polygon: BodyShape["polygon"],
): RAPIER.ColliderDesc => {
  const collider = RAPIER.ColliderDesc.convexHull(
    new Float32Array(polygon.flat()),
  );
  if (collider === null) throw new Error("Invalid convex body");
  return collider
    .setFriction(0.5)
    .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
};
