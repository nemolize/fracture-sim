import RAPIER from "@dimforge/rapier2d-compat";

import { polygonMoments } from "@/sim/polygon";
import type { Vec2 } from "@/sim/vec2";

export interface BodyShape {
  body: RAPIER.RigidBody;
  polygon: readonly (readonly [number, number])[];
  domain: readonly Vec2[];
  mass: number;
  fixed: boolean;
  ball: boolean;
}

export interface CentreExtent {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export const centreExtent = (polygon: BodyShape["polygon"]): CentreExtent => {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  return {
    left: -Math.min(...xs),
    right: Math.max(...xs),
    bottom: -Math.min(...ys),
    top: Math.max(...ys),
  };
};

const tryRawShape = (
  shape: RAPIER.Shape,
): ReturnType<RAPIER.Shape["intoRaw"]> | undefined => shape.intoRaw();

export const polygonCollider = (
  polygon: BodyShape["polygon"],
): RAPIER.ColliderDesc => {
  const [first, second, ...rest] = polygon.map(([x, y]) => ({ x, y }));
  if (first === undefined || second === undefined || rest.length === 0)
    throw new Error("Invalid convex body");
  const vertices = new Float32Array(polygon.flat());
  const hull = RAPIER.ColliderDesc.convexHull(vertices);
  if (hull === null) throw new Error("Invalid convex body");
  // Rapier can remove near-collinear vertices, even from a valid thin polygon.
  const raw = tryRawShape(hull.shape);
  let preserved = false;
  if (raw !== undefined) {
    try {
      preserved = raw.vertices()?.length === vertices.length;
    } finally {
      raw.free();
    }
  }
  let collider = hull;
  if (!preserved) {
    const parts: RAPIER.Triangle[] = [];
    let previous = second;
    for (const point of rest) {
      parts.push(new RAPIER.Triangle(first, previous, point));
      previous = point;
    }
    collider = RAPIER.ColliderDesc.compound(
      parts,
      parts.map(() => ({ x: 0, y: 0 })),
      parts.map(() => 0),
      RAPIER.CompoundFlags.FIX_INTERNAL_EDGES,
    );
  }
  return collider
    .setFriction(0.5)
    .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
};

export const createBodyShape = (
  world: RAPIER.World,
  polygon: BodyShape["polygon"],
  position: Vec2,
  density: number,
  friction: number,
  fixed: boolean,
): BodyShape => {
  const domain = polygon.map(([x, y]) => ({ x, y }));
  const { area, centroid, polarAreaMoment } = polygonMoments(domain);
  const collider = polygonCollider(polygon)
    .setMassProperties(area * density, centroid, polarAreaMoment * density)
    .setFriction(friction);
  const desc = fixed
    ? RAPIER.RigidBodyDesc.fixed()
    : RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true);
  const body = world.createRigidBody(
    desc.setTranslation(position.x, position.y),
  );
  try {
    world.createCollider(collider, body);
  } catch (error) {
    world.removeRigidBody(body);
    throw error;
  }
  return {
    body,
    polygon,
    domain,
    mass: fixed ? 0 : area * density,
    fixed,
    ball: false,
  };
};
