import RAPIER from "@dimforge/rapier2d-compat";

import {
  type ContactLoad,
  type CrushProperties,
  MIN_PATCH_FRACTION,
  ringExtent,
  sameStrength,
  type StrengthModel,
  usableCrackEnergy,
} from "@/sim/contact-stress";
import { crushSegment, segmentStiffness } from "@/sim/crush";
import {
  apportionMass,
  type DustPiece,
  type FractureResult,
  resolveFracture,
  rigidPieces,
} from "@/sim/fracture";
import { DEFAULT_CRACK_ENERGY, isPositiveFinite } from "@/sim/material";
import type { Piece } from "@/sim/split";
import type { Vec2 } from "@/sim/vec2";

import { type BodyShape, polygonCollider } from "./body";
import type { DebrisRegistry } from "./debris";
import { type BodyMotion, contactMotion, impactEnergy } from "./impact-energy";

export const MAX_BODIES = 2000;
const CRUSH_CELL = 0.05;

export interface CrushHit {
  cell: string;
  stiffness: number;
}

export class ImpactFracture {
  private readonly queue = new RAPIER.EventQueue(true);
  private readonly pending = new Map<BodyShape, FractureResult>();
  private crackEnergy = DEFAULT_CRACK_ENERGY;
  private fractureEnergy = 0;
  private strength: StrengthModel | undefined;
  private readonly crushed = new WeakMap<BodyShape, Map<string, number>>();
  readonly lastCrush = new WeakMap<BodyShape, CrushHit>();

  private minFragmentArea: number;
  private readonly debris: DebrisRegistry;

  constructor(minFragmentArea: number, debris: DebrisRegistry) {
    this.minFragmentArea = minFragmentArea;
    this.debris = debris;
  }

  setMinFragmentArea(value: number): void {
    if (!isPositiveFinite(value))
      throw new Error("Minimum fragment area must be positive and finite");
    if (value !== this.minFragmentArea) {
      this.pending.clear();
      this.minFragmentArea = value;
    }
  }

  setCrackEnergy(value: number): void {
    if (!isPositiveFinite(value))
      throw new Error("Crack energy must be positive and finite");
    if (value !== this.crackEnergy) {
      this.pending.clear();
      this.crackEnergy = value;
    }
  }

  setStrength(
    fractureEnergy: number,
    strength: StrengthModel | undefined,
  ): void {
    if (!isPositiveFinite(fractureEnergy))
      throw new Error("Fracture energy must be positive and finite");
    if (
      strength !== undefined &&
      ![
        strength.youngModulusPa,
        strength.tensileStrengthPa,
        strength.thicknessM,
      ].every(isPositiveFinite)
    )
      throw new Error("Strength model values must be positive and finite");
    if (
      !sameStrength(strength, this.strength) ||
      fractureEnergy !== this.fractureEnergy
    ) {
      this.pending.clear();
      this.strength = strength;
      this.fractureEnergy = fractureEnergy;
    }
  }

  compression(shape: BodyShape): ReadonlyMap<string, number> {
    return this.crushed.get(shape) ?? new Map<string, number>();
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
      const crushed = new Set<BodyShape>();
      let pairImpulse = 0;
      let pairLowest = Infinity;
      let pairHighest = -Infinity;
      world.contactPair(
        a.body.collider(0),
        b.body.collider(0),
        (manifold, flipped) => {
          const raw = manifold.normal();
          const pos = a.body.translation();
          const angle = a.body.rotation();
          for (let i = 0; i < manifold.numContacts(); i++) {
            const j = manifold.contactImpulse(i);
            const local = flipped
              ? manifold.localContactPoint2(i)
              : manifold.localContactPoint1(i);
            if (local === null || !(j > 0)) continue;
            const x =
              pos.x + Math.cos(angle) * local.x - Math.sin(angle) * local.y;
            const y =
              pos.y + Math.sin(angle) * local.x + Math.cos(angle) * local.y;
            const across = x * -raw.y + y * raw.x;
            pairImpulse += j;
            pairLowest = Math.min(pairLowest, across);
            pairHighest = Math.max(pairHighest, across);
          }
        },
      );
      world.contactPair(
        a.body.collider(0),
        b.body.collider(0),
        (manifold, flipped) => {
          const rawNormal = manifold.normal();
          const normal = {
            x: flipped ? -rawNormal.x : rawNormal.x,
            y: flipped ? -rawNormal.y : rawNormal.y,
          };
          const pos = a.body.translation();
          const angle = a.body.rotation();
          const toWorld = (local: Vec2): Vec2 => ({
            x: pos.x + Math.cos(angle) * local.x - Math.sin(angle) * local.y,
            y: pos.y + Math.sin(angle) * local.x + Math.cos(angle) * local.y,
          });
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
          const contact = toWorld(point);
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
          const motionA = atContact(a, first.before);
          const motionB = atContact(b, second.before);
          const shares = impactEnergy(motionA, motionB);
          const pairInverseMass = motionA.inverseMass + motionB.inverseMass;
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
            const local = {
              x: Math.cos(rotation) * dx + Math.sin(rotation) * dy,
              y: -Math.sin(rotation) * dx + Math.cos(rotation) * dy,
            };
            let usable = energy;
            const strength = this.strength;
            if (strength !== undefined) {
              const load = this.contactLoad(shape, {
                impulse: pairImpulse,
                effectiveMass: 1 / pairInverseMass,
                span: pairHighest - pairLowest,
                normal: {
                  x:
                    Math.cos(rotation) * normal.x +
                    Math.sin(rotation) * normal.y,
                  y:
                    -Math.sin(rotation) * normal.x +
                    Math.cos(rotation) * normal.y,
                },
              });
              if (strength.crush !== null) {
                if (!crushed.has(shape))
                  this.crush(
                    shape,
                    local,
                    energy,
                    load,
                    strength,
                    strength.crush,
                  );
                crushed.add(shape);
                continue;
              }
              usable = usableCrackEnergy(
                load,
                strength,
                this.fractureEnergy,
                energy,
              );
            }
            if (usable <= 0) continue;
            const result = resolveFracture(
              shape.domain,
              local,
              usable,
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

  private contactLoad(
    shape: BodyShape,
    hit: { impulse: number; effectiveMass: number; span: number; normal: Vec2 },
  ): ContactLoad {
    const extent = ringExtent(shape.domain, hit.normal);
    return {
      impulse: hit.impulse,
      effectiveMass: hit.effectiveMass,
      patchWidth: Math.min(
        extent.width,
        Math.max(hit.span, extent.width * MIN_PATCH_FRACTION),
      ),
      bodyWidth: extent.width,
      bodyDepth: extent.depth,
    };
  }

  private crush(
    shape: BodyShape,
    local: Vec2,
    energy: number,
    load: ContactLoad,
    strength: StrengthModel,
    foam: CrushProperties,
  ): void {
    const cell = [local.x, local.y]
      .map((v) => Math.round(v / CRUSH_CELL).toString())
      .join(",");
    const cells = this.crushed.get(shape) ?? new Map<string, number>();
    this.crushed.set(shape, cells);
    const area = strength.thicknessM * load.patchWidth;
    const depth = Math.min(load.bodyDepth, load.patchWidth, foam.crushDepthM);
    const before = cells.get(cell) ?? 0;
    cells.set(
      cell,
      crushSegment(before, energy, foam, strength.youngModulusPa, area, depth)
        .p,
    );
    this.lastCrush.set(shape, {
      cell,
      stiffness: segmentStiffness(
        before,
        foam,
        strength.youngModulusPa,
        area,
        depth,
      ),
    });
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
    const masses = apportionMass(
      parent.mass,
      [...solids, ...dust].map((piece) => piece.area),
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- `masses` has one share per solid, then per dust piece.
    const massAt = (index: number): number => masses[index]!;
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
    try {
      for (const [index, piece] of solids.entries()) {
        const mass = massAt(index);
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
      for (const [index, piece] of dust.entries()) {
        const { position, velocity: dustVelocity } = launch(piece);
        this.debris.spawn({
          position,
          velocity: dustVelocity,
          angularVelocity: spin,
          radius: Math.sqrt(piece.area / Math.PI),
          mass: massAt(solids.length + index),
          friction: parent.body.collider(0).friction(),
          restitution: parent.body.collider(0).restitution(),
        });
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
