import RAPIER from "@dimforge/rapier2d-compat";

import { DEFAULT_CRACK_ENERGY } from "@/sim/material";

import { type BodyShape, polygonCollider } from "./body";
import { TIME_STEP } from "./constants";
import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentSettings,
  validateEnvironment,
} from "./environment";
import { ImpactFracture, MAX_BODIES } from "./fracture";
import { RigidTools } from "./interactions";
import { limitVelocity, type ToolAction } from "./tools";
import type { Scene, Snapshot } from "./types";

let initialization: Promise<void> | undefined;
export const initializePhysics = (): Promise<void> =>
  (initialization ??= RAPIER.init());

export class RigidWorld {
  private readonly world: RAPIER.World;
  private readonly shapes: BodyShape[] = [];
  private readonly tools: RigidTools;
  private readonly fracture: ImpactFracture;
  geometryRevision = 0;
  private friction: number;
  private readonly environment: EnvironmentSettings;
  private elapsed = 0;
  private remainder = 0;
  private stepMs = 0;

  constructor(
    scene: Scene,
    environment: EnvironmentSettings = DEFAULT_ENVIRONMENT,
  ) {
    validateEnvironment(environment);
    this.environment = { ...environment };
    this.fracture = new ImpactFracture();
    this.friction = environment.friction;
    this.world = new RAPIER.World({ x: 0, y: -environment.gravity });
    this.tools = new RigidTools(
      this.world,
      () => this.shapes.filter((shape) => !shape.fixed),
      this.environment,
    );
    const { width, height } = environment;
    this.world.timestep = TIME_STEP;
    this.box(width / 2, -0.2, width / 2 + 0.4, 0.2, true);
    this.box(-0.2, height / 2, 0.2, height / 2, true);
    this.box(width + 0.2, height / 2, 0.2, height / 2, true);
    this.box(width / 2, height + 0.2, width / 2 + 0.4, 0.2, true);
    if (scene === "plate") {
      this.box(width / 2, Math.min(2.5, height - 0.5), 1, 0.5, false);
    } else {
      const count = scene === "pile" ? 1000 : 2000;
      const scale = Math.min(1, width / 10, height / 5.2);
      for (let i = 0; i < count; i++) {
        const x = 0.8 + (i % 60) * 0.14;
        const y = 0.065 + Math.floor(i / 60) * 0.14;
        this.box(x * scale, y * scale, 0.06 * scale, 0.06 * scale, false);
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
    let collider: RAPIER.ColliderDesc;
    try {
      collider = polygonCollider(polygon);
    } catch (error) {
      this.dispose();
      throw error;
    }
    const body = this.world.createRigidBody(desc.setTranslation(x, y));
    this.world.createCollider(
      collider.setDensity(this.environment.density).setFriction(this.friction),
      body,
    );
    this.shapes.push({
      body,
      polygon,
      domain: polygon.map(([x, y]) => ({ x, y })),
      mass: fixed ? 0 : 4 * hx * hy * this.environment.density,
      fixed,
      ball: false,
    });
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
        if (this.shapes.filter((s) => !s.fixed).length >= MAX_BODIES)
          return false;
        const radius = 0.12;
        const velocity = limitVelocity(action.velocity);
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
              Math.max(
                radius,
                Math.min(this.environment.width - radius, action.point.x),
              ),
              Math.max(
                radius,
                Math.min(this.environment.height - radius, action.point.y),
              ),
            )
            .setLinvel(velocity.x, velocity.y)
            .setCcdEnabled(true),
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.ball(radius)
            .setMass(2)
            .setFriction(this.friction)
            .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),
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
        this.shapes.push({
          body,
          polygon,
          domain: [],
          mass: 2,
          fixed: false,
          ball: true,
        });
        this.geometryRevision++;
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
      const first = polygon[0];
      let previous = polygon[1];
      if (first === undefined || previous === undefined)
        throw new Error("Invalid render polygon");
      for (const point of polygon.slice(2)) {
        for (const [x, y] of [first, previous, point])
          vertices.push(x, y, index, ...color);
        previous = point;
      }
    });
    return new Float32Array(vertices);
  }

  advance(
    seconds: number,
    gravity: { x: number; y: number },
    crackEnergy = DEFAULT_CRACK_ENERGY,
    friction = this.environment.friction,
  ): Snapshot {
    if (!Number.isFinite(friction) || friction < 0 || friction > 2)
      throw new Error("Invalid environment setting: friction");
    if (friction !== this.friction) {
      this.friction = friction;
      for (const { body } of this.shapes) {
        body.collider(0).setFriction(friction);
        body.wakeUp();
      }
    }
    this.fracture.setCrackEnergy(crackEnergy);
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
      if (
        this.fracture.step(this.world, this.shapes, (body) => {
          this.tools.detach(body);
        })
      )
        this.geometryRevision++;
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
      stats: {
        bodies,
        sleeping,
        stepMs: this.stepMs,
        time: this.elapsed,
        mass: this.shapes.reduce((sum, s) => sum + s.mass, 0),
      },
    };
  }

  dispose(): void {
    this.fracture.dispose();
    this.world.free();
  }
}
