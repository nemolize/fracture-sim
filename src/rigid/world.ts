import RAPIER from "@dimforge/rapier2d-compat";

import {
  GLASS_DENSITY,
  GRAVITY,
  TIME_STEP,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { RigidTools } from "./interactions";
import { limitVelocity, type ToolAction } from "./tools";
import type { Scene, Snapshot } from "./types";

let initialization: Promise<void> | undefined;
export const initializePhysics = (): Promise<void> =>
  (initialization ??= RAPIER.init());

interface BodyShape {
  body: RAPIER.RigidBody;
  polygon: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    ...(readonly [number, number])[],
  ];
  fixed: boolean;
  ball: boolean;
}

export class RigidWorld {
  private readonly world = new RAPIER.World({ x: 0, y: -GRAVITY });
  private readonly shapes: BodyShape[] = [];
  private readonly tools = new RigidTools(this.world, () =>
    this.shapes.filter((shape) => !shape.fixed),
  );
  private elapsed = 0;
  private remainder = 0;
  private stepMs = 0;

  constructor(scene: Scene) {
    this.world.timestep = TIME_STEP;
    this.box(WORLD_WIDTH / 2, -0.2, WORLD_WIDTH / 2 + 0.4, 0.2, true);
    this.box(-0.2, WORLD_HEIGHT / 2, 0.2, WORLD_HEIGHT / 2, true);
    this.box(WORLD_WIDTH + 0.2, WORLD_HEIGHT / 2, 0.2, WORLD_HEIGHT / 2, true);
    this.box(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT + 0.2,
      WORLD_WIDTH / 2 + 0.4,
      0.2,
      true,
    );
    if (scene === "plate") {
      this.box(5, 2.5, 1, 0.5, false);
    } else {
      const count = scene === "pile" ? 1000 : 2000;
      for (let i = 0; i < count; i++) {
        const x = 0.8 + (i % 60) * 0.14;
        const y = 0.065 + Math.floor(i / 60) * 0.14;
        this.box(x, y, 0.06, 0.06, false);
      }
    }
  }

  private box(
    x: number,
    y: number,
    hx: number,
    hy: number,
    fixed: boolean,
  ): void {
    const desc = fixed
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true);
    const polygon: BodyShape["polygon"] = [
      [-hx, -hy],
      [hx, -hy],
      [hx, hy],
      [-hx, hy],
    ];
    const collider = RAPIER.ColliderDesc.convexHull(
      new Float32Array(polygon.flat()),
    );
    if (collider === null) {
      this.world.free();
      throw new Error("Invalid convex body");
    }
    const body = this.world.createRigidBody(desc.setTranslation(x, y));
    this.world.createCollider(
      collider.setDensity(GLASS_DENSITY).setFriction(0.5),
      body,
    );
    this.shapes.push({ body, polygon, fixed, ball: false });
  }

  apply(action: ToolAction): boolean {
    switch (action.type) {
      case "grab":
        this.tools.start(action.point);
        break;
      case "move":
        this.tools.move(action.point);
        break;
      case "release":
        this.tools.release(action.velocity);
        break;
      case "blast":
        this.tools.blast(action.point);
        break;
      case "throw": {
        const radius = 0.12;
        const velocity = limitVelocity(action.velocity);
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
              Math.max(radius, Math.min(WORLD_WIDTH - radius, action.point.x)),
              Math.max(radius, Math.min(WORLD_HEIGHT - radius, action.point.y)),
            )
            .setLinvel(velocity.x, velocity.y)
            .setCcdEnabled(true),
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.ball(radius).setMass(2),
          body,
        );
        const point = (i: number): readonly [number, number] => [
          radius * Math.cos((i * Math.PI) / 4),
          radius * Math.sin((i * Math.PI) / 4),
        ];
        const polygon: BodyShape["polygon"] = [
          point(0),
          point(1),
          point(2),
          ...Array.from({ length: 5 }, (_, i) => point(i + 3)),
        ];
        this.shapes.push({ body, polygon, fixed: false, ball: true });
        return true;
      }
    }
    return false;
  }

  vertices(): Float32Array<ArrayBuffer> {
    const vertices: number[] = [];
    this.shapes.forEach(({ polygon, fixed, ball }, index) => {
      const color = fixed
        ? [0.82, 0.84, 0.86]
        : ball
          ? [0.95, 0.47, 0.16]
          : [0.16, 0.63, 0.76];
      let previous = polygon[1];
      for (const point of polygon.slice(2)) {
        for (const [x, y] of [polygon[0], previous, point])
          vertices.push(x, y, index, ...color);
        previous = point;
      }
    });
    return new Float32Array(vertices);
  }

  advance(seconds: number, gravity: { x: number; y: number }): Snapshot {
    const changed =
      Math.hypot(
        this.world.gravity.x - gravity.x,
        this.world.gravity.y - gravity.y,
      ) > 0.001;
    this.world.gravity = gravity;
    if (changed) {
      for (const { body, fixed } of this.shapes) if (!fixed) body.wakeUp();
    }
    this.remainder += Math.min(Math.max(seconds, 0), 0.1);
    const start = performance.now();
    let steps = 0;
    while (this.remainder + 1e-10 >= TIME_STEP) {
      this.tools.update();
      this.world.step();
      this.elapsed += TIME_STEP;
      this.remainder -= TIME_STEP;
      steps++;
    }
    if (steps > 0) this.stepMs = (performance.now() - start) / steps;
    return this.snapshot();
  }

  snapshot(): Snapshot {
    const poses = new Float32Array(this.shapes.length * 4);
    let sleeping = 0;
    let bodies = 0;
    this.shapes.forEach(({ body, fixed }, i) => {
      const { x, y } = body.translation();
      const angle = body.rotation();
      if (!Number.isFinite(x + y + angle))
        throw new Error("Non-finite rigid-body state");
      poses.set([x, y, Math.cos(angle), Math.sin(angle)], i * 4);
      if (!fixed) {
        bodies++;
        if (body.isSleeping()) sleeping++;
      }
    });
    return {
      poses,
      stats: { bodies, sleeping, stepMs: this.stepMs, time: this.elapsed },
    };
  }

  dispose(): void {
    this.world.free();
  }
}
