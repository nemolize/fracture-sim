import RAPIER from "@dimforge/rapier2d-compat";

import {
  type DustPiece,
  type FractureResult,
  resolveFracture,
  rigidPieces,
} from "@/sim/fracture";
import { DEFAULT_CRACK_ENERGY, isCrackEnergy } from "@/sim/material";
import type { ParticleField } from "@/sim/particles";
import type { Piece } from "@/sim/split";

import { type BodyShape, polygonCollider } from "./body";
import { type BodyMotion, contactMotion, impactEnergy } from "./impact-energy";

export const MAX_BODIES = 2000;

export class ImpactFracture {
  private readonly queue = new RAPIER.EventQueue(true);
  private readonly pending = new Map<BodyShape, FractureResult>();
  private crackEnergy = DEFAULT_CRACK_ENERGY;

  private minFragmentArea: number;
  private readonly particles: ParticleField;

  constructor(minFragmentArea: number, particles: ParticleField) {
    this.minFragmentArea = minFragmentArea;
    this.particles = particles;
  }

  setMinFragmentArea(value: number): void {
    if (!isCrackEnergy(value))
      throw new Error("Minimum fragment area must be positive and finite");
    if (value !== this.minFragmentArea) {
      this.pending.clear();
      this.minFragmentArea = value;
    }
  }

  setCrackEnergy(value: number): void {
    if (!isCrackEnergy(value))
      throw new Error("Crack energy must be positive and finite");
    if (value !== this.crackEnergy) {
      this.pending.clear();
      this.crackEnergy = value;
    }
  }

  step(
    world: RAPIER.World,
    shapes: BodyShape[],
    detach: (body: RAPIER.RigidBody) => void,
  ): boolean {
    const motion = (shape: BodyShape): BodyMotion => ({
      velocity: shape.body.linvel(),
      angularVelocity: shape.body.angvel(),
    });
    const byCollider = new Map(
      shapes.map((shape) => [
        shape.body.collider(0).handle,
        { shape, before: motion(shape) },
      ]),
    );
    world.step(this.queue);
    this.queue.drainContactForceEvents((event) => {
      const first = byCollider.get(event.collider1());
      const second = byCollider.get(event.collider2());
      if (first === undefined || second === undefined) return;
      const a = first.shape,
        b = second.shape;
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
          const rawNormal = manifold.normal();
          const normal = {
            x: flipped ? -rawNormal.x : rawNormal.x,
            y: flipped ? -rawNormal.y : rawNormal.y,
          };
          const atContact = (shape: BodyShape, before: BodyMotion) => {
            const center = shape.body.worldCom();
            return contactMotion(
              before,
              motion(shape),
              { x: contact.x - center.x, y: contact.y - center.y },
              normal,
              shape.fixed ? 0 : shape.body.invMass(),
              shape.fixed ? 0 : shape.body.invPrincipalInertia(),
            );
          };
          const shares = impactEnergy(
            atContact(a, first.before),
            atContact(b, second.before),
          );
          for (const [shape, energy] of [
            [a, shares[0]],
            [b, shares[1]],
          ] as const) {
            if (energy <= 0) continue;
            if (shape.fixed || shape.ball || this.pending.has(shape)) continue;
            const origin = shape.body.translation();
            const rotation = shape.body.rotation();
            const dx = contact.x - origin.x,
              dy = contact.y - origin.y;
            const result = resolveFracture(
              shape.domain,
              {
                x: Math.cos(rotation) * dx + Math.sin(rotation) * dy,
                y: -Math.sin(rotation) * dx + Math.cos(rotation) * dy,
              },
              energy,
              this.crackEnergy,
              this.minFragmentArea,
            );
            if (result !== null) this.pending.set(shape, result);
          }
        },
      );
    });
    let count = shapes.filter((s) => !s.fixed).length;
    let changed = false;
    for (const [parent, result] of this.pending) {
      const solids =
        result.kind === "split"
          ? rigidPieces(result.pieces, this.minFragmentArea)
          : [];
      const delta = solids.length - 1;
      if (count + delta > MAX_BODIES) continue;
      const dust =
        result.kind === "dust"
          ? [result.piece]
          : result.pieces.filter((piece) => !solids.includes(piece));
      const children = this.children(world, parent, solids, dust);
      detach(parent.body);
      world.removeRigidBody(parent.body);
      shapes.splice(shapes.indexOf(parent), 1, ...children);
      this.pending.delete(parent);
      count += delta;
      changed = true;
    }
    return changed;
  }

  private children(
    world: RAPIER.World,
    parent: BodyShape,
    solids: readonly Piece[],
    dust: readonly DustPiece[],
  ): BodyShape[] {
    const origin = parent.body.translation();
    const angle = parent.body.rotation();
    const velocity = parent.body.linvel();
    const spin = parent.body.angvel();
    const created: BodyShape[] = [];
    const solidArea = solids.reduce((sum, piece) => sum + piece.area, 0);
    const launch = (piece: DustPiece) => {
      const dx =
        Math.cos(angle) * piece.centroidOffset.x -
        Math.sin(angle) * piece.centroidOffset.y;
      const dy =
        Math.sin(angle) * piece.centroidOffset.x +
        Math.cos(angle) * piece.centroidOffset.y;
      return {
        position: { x: origin.x + dx, y: origin.y + dy },
        velocity: { x: velocity.x - spin * dy, y: velocity.y + spin * dx },
      };
    };
    let assigned = 0;
    try {
      for (const piece of solids) {
        // Dust carries no mass of its own: the rigid pieces share the parent's whole mass.
        const mass =
          piece === solids[solids.length - 1]
            ? parent.mass - assigned
            : (parent.mass * piece.area) / solidArea;
        assigned += mass;
        const { position, velocity: pieceVelocity } = launch(piece);
        const polygon = piece.polygon.map((p): readonly [number, number] => [
          p.x,
          p.y,
        ]);
        const collider = polygonCollider(polygon)
          .setFriction(parent.body.collider(0).friction())
          .setRestitution(parent.body.collider(0).restitution())
          .setMassProperties(
            mass,
            { x: 0, y: 0 },
            (mass / piece.area) * piece.polarAreaMoment,
          );
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y)
            .setRotation(angle)
            .setLinvel(pieceVelocity.x, pieceVelocity.y)
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
      for (const piece of dust) {
        const { position, velocity: dustVelocity } = launch(piece);
        this.particles.spawn(position, dustVelocity, Math.sqrt(piece.area));
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
