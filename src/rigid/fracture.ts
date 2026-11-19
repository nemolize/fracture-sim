import RAPIER from "@dimforge/rapier2d-compat";

import { fracturePieces } from "@/sim/fracture";
import { polygonMoments } from "@/sim/polygon";
import type { Piece } from "@/sim/split";

import { type BodyShape, polygonCollider } from "./body";

export const MAX_BODIES = 2000;

export class ImpactFracture {
  private readonly queue = new RAPIER.EventQueue(true);
  private readonly pending = new Map<BodyShape, Piece[]>();

  step(
    world: RAPIER.World,
    shapes: BodyShape[],
    detach: (body: RAPIER.RigidBody) => void,
  ): boolean {
    world.step(this.queue);
    const byCollider = new Map(
      shapes.map((s) => [s.body.collider(0).handle, s]),
    );
    this.queue.drainContactForceEvents((event) => {
      const a = byCollider.get(event.collider1());
      const b = byCollider.get(event.collider2());
      if (a === undefined || b === undefined) return;
      world.contactPair(
        a.body.collider(0),
        b.body.collider(0),
        (manifold, flipped) => {
          let impulse = 0;
          const point = { x: 0, y: 0 };
          for (let i = 0; i < manifold.numContacts(); i++) {
            const j = manifold.contactImpulse(i);
            const local = flipped
              ? manifold.localContactPoint2(i)
              : manifold.localContactPoint1(i);
            if (local === null) continue;
            impulse += j;
            point.x += local.x * j;
            point.y += local.y * j;
          }
          if (impulse <= 0) return;
          point.x /= impulse;
          point.y /= impulse;
          const pos = a.body.translation();
          const angle = a.body.rotation();
          const contact = {
            x: pos.x + Math.cos(angle) * point.x - Math.sin(angle) * point.y,
            y: pos.y + Math.sin(angle) * point.x + Math.cos(angle) * point.y,
          };
          const normal = manifold.normal();
          const inverseMass = (s: BodyShape): number => {
            if (s.fixed) return 0;
            const center = s.body.worldCom();
            const lever =
              (contact.x - center.x) * normal.y -
              (contact.y - center.y) * normal.x;
            return (
              s.body.invMass() + lever * lever * s.body.invPrincipalInertia()
            );
          };
          const energy =
            (impulse * impulse * (inverseMass(a) + inverseMass(b))) / 2;
          for (const shape of [a, b]) {
            if (shape.fixed || shape.ball || this.pending.has(shape)) continue;
            const origin = shape.body.translation();
            const rotation = shape.body.rotation();
            const dx = contact.x - origin.x,
              dy = contact.y - origin.y;
            const pieces = fracturePieces(
              shape.domain,
              {
                x: Math.cos(rotation) * dx + Math.sin(rotation) * dy,
                y: -Math.sin(rotation) * dx + Math.cos(rotation) * dy,
              },
              energy,
            );
            if (pieces.length > 1) this.pending.set(shape, pieces);
          }
        },
      );
    });
    let count = shapes.filter((s) => !s.fixed).length;
    let changed = false;
    for (const [parent, pieces] of this.pending) {
      if (count + pieces.length - 1 > MAX_BODIES) continue;
      const children = this.children(world, parent, pieces);
      detach(parent.body);
      world.removeRigidBody(parent.body);
      shapes.splice(shapes.indexOf(parent), 1, ...children);
      this.pending.delete(parent);
      count += pieces.length - 1;
      changed = true;
    }
    return changed;
  }

  private children(
    world: RAPIER.World,
    parent: BodyShape,
    pieces: Piece[],
  ): BodyShape[] {
    const area = polygonMoments(parent.domain).area;
    const origin = parent.body.translation();
    const angle = parent.body.rotation();
    const velocity = parent.body.linvel();
    const spin = parent.body.angvel();
    const created: BodyShape[] = [];
    let assigned = 0;
    try {
      for (const [i, piece] of pieces.entries()) {
        const mass =
          i === pieces.length - 1
            ? parent.mass - assigned
            : (parent.mass * piece.area) / area;
        assigned += mass;
        const dx =
          Math.cos(angle) * piece.centroidOffset.x -
          Math.sin(angle) * piece.centroidOffset.y;
        const dy =
          Math.sin(angle) * piece.centroidOffset.x +
          Math.cos(angle) * piece.centroidOffset.y;
        const polygon = piece.polygon.map((p): readonly [number, number] => [
          p.x,
          p.y,
        ]);
        const collider = polygonCollider(polygon).setMassProperties(
          mass,
          { x: 0, y: 0 },
          (mass / piece.area) * piece.polarAreaMoment,
        );
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(origin.x + dx, origin.y + dy)
            .setRotation(angle)
            .setLinvel(velocity.x - spin * dy, velocity.y + spin * dx)
            .setAngvel(spin)
            .setCcdEnabled(true),
        );
        created.push({
          body,
          polygon,
          domain: piece.domain,
          mass,
          fixed: false,
          ball: false,
        });
        world.createCollider(collider, body);
      }
      return created;
    } catch (error) {
      for (const child of created) world.removeRigidBody(child.body);
      throw error;
    }
  }

  dispose(): void {
    this.queue.free();
  }
}
