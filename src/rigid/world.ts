import RAPIER from "@dimforge/rapier2d-compat";

import { DEFAULT_CRACK_ENERGY } from "@/sim/material";

import { type BodyShape, createBodyShape } from "./body";
import {
  TIME_STEP,
  WAKE_GRAVITY_DELTA,
  WAKE_GRAVITY_SMOOTHING,
  WORLD_WIDTH,
} from "./constants";
import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentSettings,
  validateEnvironment,
} from "./environment";
import { ImpactFracture, MAX_BODIES } from "./fracture";
import { RigidTools } from "./interactions";
import { objectPolygon, type ObjectShape } from "./object-shape";
import {
  DEFAULT_OBJECT_SIZE,
  fitObjectSize,
  type ObjectSize,
  validateObjectSize,
} from "./object-size";
import { limitVelocity, type ToolAction } from "./tools";
import type { Scene, Snapshot } from "./types";

const WALL_HALF_HEIGHT = 100;

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
  private wakeGravity: { x: number; y: number };
  private averageGravity: { x: number; y: number };
  private readonly environment: EnvironmentSettings;
  private readonly ceiling: RAPIER.RigidBody;
  private readonly baseHeight: number;
  private elapsed = 0;
  private remainder = 0;
  private stepMs = 0;

  constructor(
    scene: Scene,
    environment: EnvironmentSettings = DEFAULT_ENVIRONMENT,
    objectSize: ObjectSize = fitObjectSize(DEFAULT_OBJECT_SIZE, environment),
    objectShape: ObjectShape = "rectangle",
  ) {
    validateEnvironment(environment);
    validateObjectSize(objectSize, environment);
    const initialPolygon = objectPolygon(objectShape, objectSize);
    this.environment = { ...environment };
    this.fracture = new ImpactFracture();
    this.friction = environment.friction;
    this.wakeGravity = { x: 0, y: -environment.gravity };
    this.averageGravity = { ...this.wakeGravity };
    this.world = new RAPIER.World({ ...this.wakeGravity });
    this.tools = new RigidTools(
      this.world,
      () => this.shapes.filter((shape) => !shape.fixed),
      this.environment,
    );
    const { width, height } = environment;
    this.world.timestep = TIME_STEP;
    this.world.lengthUnit = Math.min(1, width / WORLD_WIDTH);
    this.box(width / 2, -0.2, width / 2 + 0.4, 0.2, true);
    this.box(-0.2, 0, 0.2, WALL_HALF_HEIGHT, true);
    this.box(width + 0.2, 0, 0.2, WALL_HALF_HEIGHT, true);
    this.ceiling = this.box(
      width / 2,
      height + 0.2,
      width / 2 + 0.4,
      0.2,
      true,
    );
    this.baseHeight = height;
    if (scene === "plate") {
      const plate = this.addBody(
        initialPolygon,
        width / 2,
        -Math.min(...initialPolygon.map((point) => point[1])),
        false,
      );
      // New floor contacts wake bodies, so initialize them before sleeping.
      this.world.step();
      plate.sleep();
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

  setVisibleHeight(visible: number): void {
    if (!Number.isFinite(visible) || visible < 0)
      throw new Error("Invalid visible height");
    const height = Math.max(this.baseHeight, visible);
    if (height === this.environment.height) return;
    this.environment.height = height;
    this.ceiling.setTranslation(
      { x: this.environment.width / 2, y: height + 0.2 },
      true,
    );
    for (const { body, fixed } of this.shapes) if (!fixed) body.wakeUp();
  }

  private box(
    x: number,
    y: number,
    hx: number,
    hy: number,
    fixed: boolean,
  ): RAPIER.RigidBody {
    return this.addBody(
      [
        [-hx, -hy],
        [hx, -hy],
        [hx, hy],
        [-hx, hy],
      ],
      x,
      y,
      fixed,
    );
  }

  private addBody(
    polygon: BodyShape["polygon"],
    x: number,
    y: number,
    fixed: boolean,
  ): RAPIER.RigidBody {
    try {
      const shape = createBodyShape(
        this.world,
        polygon,
        { x, y },
        this.environment.density,
        this.friction,
        fixed,
      );
      this.shapes.push(shape);
      return shape.body;
    } catch (error) {
      this.dispose();
      throw error;
    }
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
        const radius = Math.min(0.12, this.environment.width / 20);
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
    this.world.gravity = gravity;
    // A raw sample as the reference would bounce between noise extremes, so average first.
    const blend =
      1 -
      Math.exp(-Math.min(Math.max(seconds, 0), 0.1) / WAKE_GRAVITY_SMOOTHING);
    this.averageGravity.x += (gravity.x - this.averageGravity.x) * blend;
    this.averageGravity.y += (gravity.y - this.averageGravity.y) * blend;
    if (
      Math.hypot(
        this.wakeGravity.x - this.averageGravity.x,
        this.wakeGravity.y - this.averageGravity.y,
      ) > WAKE_GRAVITY_DELTA
    ) {
      this.wakeGravity = { ...this.averageGravity };
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
