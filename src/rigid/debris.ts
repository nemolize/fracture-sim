import RAPIER from "@dimforge/rapier2d-compat";

import type { Vec2 } from "@/sim/vec2";

import { DEBRIS_STRIDE, MAX_DEBRIS } from "./constants";

export interface DebrisSpec {
  position: Vec2;
  velocity: Vec2;
  angularVelocity: number;
  radius: number;
  mass: number;
  friction: number;
  restitution: number;
}

interface Debris {
  body: RAPIER.RigidBody;
  radius: number;
  mass: number;
}

/** Circles outside `BodyShape` and `MAX_BODIES`; at capacity the oldest goes, mass included. */
export class DebrisRegistry {
  private readonly world: RAPIER.World;
  private readonly slots: Debris[] = [];
  private oldest = 0;

  constructor(world: RAPIER.World) {
    this.world = world;
  }

  get size(): number {
    return this.slots.length;
  }

  get mass(): number {
    let total = 0;
    this.each((piece) => {
      total += piece.mass;
    });
    return total;
  }

  spawn(spec: DebrisSpec): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spec.position.x, spec.position.y)
        .setLinvel(spec.velocity.x, spec.velocity.y)
        .setAngvel(spec.angularVelocity),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(spec.radius)
        .setMass(spec.mass)
        .setFriction(spec.friction)
        .setRestitution(spec.restitution),
      body,
    );
    const piece = { body, radius: spec.radius, mass: spec.mass };
    if (this.slots.length < MAX_DEBRIS) {
      this.slots.push(piece);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- `oldest` indexes a full slot array.
    this.world.removeRigidBody(this.slots[this.oldest]!.body);
    this.slots[this.oldest] = piece;
    this.oldest = (this.oldest + 1) % MAX_DEBRIS;
  }

  setSurface(friction: number, restitution: number): void {
    this.each(({ body }) => {
      body.collider(0).setFriction(friction);
      body.collider(0).setRestitution(restitution);
    });
  }

  wake(): void {
    this.each(({ body }) => {
      body.wakeUp();
    });
  }

  contain(width: number, height: number): void {
    this.each(({ body, radius }) => {
      if (body.isSleeping()) return;
      const { x, y } = body.translation();
      if (x >= 0 && x <= width && y >= 0 && y <= height) return;
      body.setTranslation(
        {
          x: Math.min(Math.max(x, radius), width - radius),
          y: Math.min(Math.max(y, radius), height - radius),
        },
        true,
      );
      body.setLinvel({ x: 0, y: 0 }, true);
    });
  }

  snapshot(): Float32Array<ArrayBuffer> {
    const out = new Float32Array(this.slots.length * DEBRIS_STRIDE);
    let i = 0;
    this.each(({ body, radius }) => {
      const { x, y } = body.translation();
      if (!Number.isFinite(x + y)) throw new Error("Non-finite debris state");
      out.set([x, y, radius * 2], i * DEBRIS_STRIDE);
      i++;
    });
    return out;
  }

  private each(visit: (piece: Debris) => void): void {
    for (const piece of this.slots) visit(piece);
  }
}
