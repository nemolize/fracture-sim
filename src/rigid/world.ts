import RAPIER from "@dimforge/rapier2d-compat";

import { DEFAULT_FLOOR_MATERIAL } from "@/sim/floor-material";
import {
  arealDensity,
  BOUNDARY_SURFACE,
  DEFAULT_MATERIAL,
  type LiveMaterials,
  liveMaterials,
  type Surface,
  validateMaterial,
  validateSurface,
  type WorldMaterials,
} from "@/sim/material";

import { type BodyShape, centreExtent, createBodyShape } from "./body";
import {
  TIME_STEP,
  WAKE_GRAVITY_DELTA,
  WAKE_GRAVITY_SMOOTHING,
} from "./constants";
import { DebrisRegistry } from "./debris";
import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentSettings,
  validateEnvironment,
  worldScale,
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
import { GLASS_COLOR } from "./palette";
import { limitVelocity, type ToolAction } from "./tools";
import type { Snapshot } from "./types";

const WALL_HALF_HEIGHT = 100;
const sameSurface = (a: Surface, b: Surface): boolean =>
  a.friction === b.friction && a.restitution === b.restitution;

const WALL_THICKNESS = 0.4;

let initialization: Promise<void> | undefined;
export const initializePhysics = (): Promise<void> =>
  (initialization ??= RAPIER.init());

export class RigidWorld {
  private readonly world: RAPIER.World;
  private readonly shapes: BodyShape[] = [];
  private readonly tools: RigidTools;
  private readonly debris: DebrisRegistry;
  private readonly fracture: ImpactFracture;
  private readonly areaScale: number;
  geometryRevision = 0;
  private live: LiveMaterials;
  private readonly floor: RAPIER.RigidBody;
  private readonly arealDensity: number;
  private wakeGravity: { x: number; y: number };
  private averageGravity: { x: number; y: number };
  private readonly environment: EnvironmentSettings;
  private readonly ceiling: RAPIER.RigidBody;
  private readonly baseHeight: number;
  private elapsed = 0;
  private remainder = 0;
  private stepMs = 0;

  constructor(
    environment: EnvironmentSettings = DEFAULT_ENVIRONMENT,
    objectSize: ObjectSize = fitObjectSize(DEFAULT_OBJECT_SIZE, environment),
    objectShape: ObjectShape = "rectangle",
    materials: WorldMaterials = {
      floor: DEFAULT_FLOOR_MATERIAL,
      object: DEFAULT_MATERIAL,
    },
  ) {
    validateEnvironment(environment);
    validateMaterial(materials.object);
    validateSurface(materials.floor);
    validateObjectSize(objectSize, environment);
    const initialPolygon = objectPolygon(objectShape, objectSize);
    this.environment = { ...environment };
    const lengthScale = Math.min(1, worldScale(environment));
    this.areaScale = lengthScale ** 2;
    this.arealDensity = arealDensity(materials.object);
    this.live = liveMaterials(materials);
    this.wakeGravity = { x: 0, y: -environment.gravity };
    this.averageGravity = { ...this.wakeGravity };
    this.world = new RAPIER.World({ ...this.wakeGravity });
    this.debris = new DebrisRegistry(this.world);
    this.fracture = new ImpactFracture(
      materials.object.minFragmentArea * this.areaScale,
      this.debris,
    );
    this.tools = new RigidTools(
      this.world,
      () => this.shapes.filter((shape) => !shape.fixed),
      this.environment,
    );
    const { width, height } = environment;
    this.world.timestep = TIME_STEP;
    this.world.lengthUnit = lengthScale;
    this.floor = this.box(
      width / 2,
      -0.2,
      width / 2 + 0.4,
      0.2,
      this.live.floor,
      true,
    );
    this.box(-0.2, 0, 0.2, WALL_HALF_HEIGHT, BOUNDARY_SURFACE, true);
    this.box(width + 0.2, 0, 0.2, WALL_HALF_HEIGHT, BOUNDARY_SURFACE, true);
    this.ceiling = this.box(
      width / 2,
      height + 0.2,
      width / 2 + 0.4,
      0.2,
      BOUNDARY_SURFACE,
      true,
    );
    this.baseHeight = height;
    const plate = this.addBody(
      initialPolygon,
      width / 2,
      centreExtent(initialPolygon).bottom,
      this.live.object,
      false,
    );
    // New floor contacts wake bodies, so initialize them before sleeping.
    this.world.step();
    plate.sleep();
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
    this.wakeBodies();
  }

  private wakeBodies(): void {
    for (const { body, fixed } of this.shapes) if (!fixed) body.wakeUp();
    this.debris.wake();
  }

  private box(
    x: number,
    y: number,
    hx: number,
    hy: number,
    surface: Surface,
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
      surface,
      fixed,
    );
  }

  private addBody(
    polygon: BodyShape["polygon"],
    x: number,
    y: number,
    surface: Surface,
    fixed: boolean,
  ): RAPIER.RigidBody {
    try {
      const shape = createBodyShape(
        this.world,
        polygon,
        { x, y },
        this.arealDensity,
        surface,
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
        const mass = this.arealDensity * Math.PI * radius ** 2;
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
            .setMass(mass)
            .setFriction(this.live.object.friction)
            .setRestitution(this.live.object.restitution)
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
          mass,
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
          : GLASS_COLOR;
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

  private applyMaterials(materials: LiveMaterials): void {
    validateSurface(materials.floor);
    validateSurface(materials.object);
    if (!sameSurface(materials.floor, this.live.floor)) {
      this.floor.collider(0).setFriction(materials.floor.friction);
      this.floor.collider(0).setRestitution(materials.floor.restitution);
      this.wakeBodies();
    }
    if (!sameSurface(materials.object, this.live.object)) {
      for (const { body, fixed } of this.shapes) {
        if (fixed) continue;
        body.collider(0).setFriction(materials.object.friction);
        body.collider(0).setRestitution(materials.object.restitution);
      }
      this.debris.setSurface(
        materials.object.friction,
        materials.object.restitution,
      );
      this.wakeBodies();
    }
    this.live = materials;
    this.fracture.setCrackEnergy(materials.crackEnergy);
    this.fracture.setMinFragmentArea(
      materials.minFragmentArea * this.areaScale,
    );
  }

  advance(
    seconds: number,
    gravity: { x: number; y: number },
    materials: LiveMaterials = this.live,
  ): Snapshot {
    this.applyMaterials(materials);
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
      this.wakeBodies();
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
      this.returnSunkBodies();
      this.debris.contain(this.environment.width, this.environment.height);
      this.elapsed += TIME_STEP;
      this.remainder -= TIME_STEP;
      steps++;
    }
    if (steps > 0) this.stepMs = (performance.now() - start) / steps;
    return this.snapshot();
  }

  private returnSunkBodies(): void {
    const { width, height } = this.environment;
    for (const { body, polygon, fixed, ball } of this.shapes) {
      if (fixed || body.isSleeping()) continue;
      const { x, y } = body.translation();
      const inside = x > 0 && x < width && y > 0 && y < height;
      const inWall =
        x > -WALL_THICKNESS &&
        x < width + WALL_THICKNESS &&
        y > -WALL_THICKNESS &&
        y < height + WALL_THICKNESS;
      if (inside || !inWall) continue;
      const extent = centreExtent(polygon, ball ? 0 : body.rotation());
      body.setTranslation(
        {
          x: Math.min(Math.max(x, extent.left), width - extent.right),
          y: Math.min(Math.max(y, extent.bottom), height - extent.top),
        },
        true,
      );
      body.setLinvel({ x: 0, y: 0 }, true);
    }
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
      particles: this.debris.snapshot(),
      stats: {
        bodies,
        sleeping,
        particles: this.debris.size,
        stepMs: this.stepMs,
        time: this.elapsed,
        mass:
          this.shapes.reduce((sum, s) => sum + s.mass, 0) + this.debris.mass,
      },
    };
  }

  dispose(): void {
    this.fracture.dispose();
    this.world.free();
  }
}
