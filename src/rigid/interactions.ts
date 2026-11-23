import RAPIER from "@dimforge/rapier2d-compat";

import type { Vec2 } from "@/sim/vec2";

import { DEFAULT_ENVIRONMENT, type EnvironmentSettings } from "./environment";
import { blastRadius, limitVelocity } from "./tools";

interface ToolBody {
  body: RAPIER.RigidBody;
  polygon: readonly (readonly [number, number])[];
}

interface Grab extends ToolBody {
  local: Vec2;
  target: Vec2;
  pointer: RAPIER.RigidBody;
}

export class RigidTools {
  private readonly world: RAPIER.World;
  private readonly bodies: () => ToolBody[];
  private grab: Grab | null = null;
  private readonly bounds: Pick<EnvironmentSettings, "width" | "height">;

  constructor(
    world: RAPIER.World,
    bodies: () => ToolBody[],
    bounds: Pick<EnvironmentSettings, "width" | "height"> = DEFAULT_ENVIRONMENT,
  ) {
    this.bounds = bounds;
    this.world = world;
    this.bodies = bodies;
  }

  start(point: Vec2): void {
    this.release({ x: 0, y: 0 });
    const selected = this.bodies().find((candidate) =>
      candidate.body.collider(0).containsPoint(point),
    );
    if (selected === undefined) return;
    const { body, polygon } = selected;
    const position = body.translation();
    const angle = body.rotation();
    const dx = point.x - position.x;
    const dy = point.y - position.y;
    const local = {
      x: Math.cos(angle) * dx + Math.sin(angle) * dy,
      y: -Math.sin(angle) * dx + Math.cos(angle) * dy,
    };
    const pointer = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        point.x,
        point.y,
      ),
    );
    const frequency = 2 * Math.PI * 12;
    const joint = RAPIER.JointData.spring(
      0,
      body.mass() * frequency * frequency,
      body.mass() * 2 * frequency,
      local,
      { x: 0, y: 0 },
    );
    this.world.createImpulseJoint(joint, body, pointer, true);
    this.grab = { body, pointer, polygon, local, target: point };
  }

  move(point: Vec2): void {
    if (this.grab === null) return;
    this.grab.target = point;
    this.update();
  }

  update(): void {
    const grab = this.grab;
    if (grab === null) return;
    const angle = grab.body.rotation();
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const anchor = {
      x: c * grab.local.x - s * grab.local.y,
      y: s * grab.local.x + c * grab.local.y,
    };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const collider = grab.body.collider(0);
    if (collider.shapeType() === RAPIER.ShapeType.Ball) {
      minX = minY = -collider.radius();
      maxX = maxY = collider.radius();
    } else {
      for (const [x, y] of grab.polygon) {
        const px = c * x - s * y,
          py = s * x + c * y;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
    grab.pointer.setNextKinematicTranslation({
      x: Math.max(
        anchor.x - minX,
        Math.min(this.bounds.width + anchor.x - maxX, grab.target.x),
      ),
      y: Math.max(
        anchor.y - minY,
        Math.min(this.bounds.height + anchor.y - maxY, grab.target.y),
      ),
    });
  }

  release(velocity: Vec2): void {
    if (this.grab === null) return;
    this.world.removeRigidBody(this.grab.pointer);
    this.grab.body.setLinvel(limitVelocity(velocity), true);
    this.grab = null;
  }

  detach(body: RAPIER.RigidBody): void {
    if (this.grab?.body !== body) return;
    this.world.removeRigidBody(this.grab.pointer);
    this.grab = null;
  }

  blast(point: Vec2): void {
    const radius = blastRadius(this.bounds.width);
    for (const { body } of this.bodies()) {
      const position = body.translation();
      const dx = position.x - point.x;
      const dy = position.y - point.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= radius) continue;
      const speed = 8 * (1 - distance / radius);
      const direction =
        distance === 0
          ? { x: 0, y: 1 }
          : { x: dx / distance, y: dy / distance };
      body.applyImpulse(
        {
          x: direction.x * speed * body.mass(),
          y: direction.y * speed * body.mass(),
        },
        true,
      );
    }
  }
}
