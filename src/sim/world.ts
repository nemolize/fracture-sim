import { at, atInt } from "./array";
import { labelChunks } from "./chunks";
import {
  addGrabForce,
  AIR_DRAG,
  applyBlast,
  type Ball,
  BLAST_RADIUS,
  BLAST_SPEED,
  collideBall,
  collideBounds,
  type Grab,
  GRAB_RADIUS,
  GRAVITY,
  makeBall,
  MAX_BALLS,
  stepBall,
} from "./contact";
import { addElementForces } from "./elements";
import { type MaterialName, MATERIALS } from "./materials";
import { timeStep } from "./resolution";
import { restShape } from "./rest";
import { buildMesh, CELL, type SceneName, WORLD_WIDTH } from "./scenes";
import type { Solid } from "./solid";
import type { WorldStats } from "./stats";

export interface WorldOptions {
  scene: SceneName;
  material: MaterialName;
  seed?: number;
  /** Mesh cell size in metres; also fixes the default time step. */
  cell?: number;
}

export class World implements Solid {
  readonly width = WORLD_WIDTH;
  readonly material;
  readonly nodeCount: number;
  readonly triCount: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly fx: Float64Array;
  readonly fy: Float64Array;
  readonly mass: Float64Array;
  readonly nodeRefs: Int32Array;
  readonly tri: Int32Array;
  readonly restInverse: Float64Array;
  readonly plasticInverse: Float64Array;
  readonly restArea: Float64Array;
  readonly plasticStrain: Float64Array;
  readonly damage: Float64Array;
  readonly stressRatio: Float64Array;
  readonly alive: Uint8Array;
  /** Piece id per triangle, -1 once eroded; refreshed by `refreshChunks`. */
  readonly chunkOf: Int32Array;
  readonly balls: Ball[] = [];
  /** Explicit time step used by `step` when none is given. */
  readonly dt: number;
  chunkCount = 1;
  time = 0;
  private erodedCount = 0;
  private grab: Grab | null = null;

  constructor({ scene, material, seed = 1, cell = CELL }: WorldOptions) {
    this.material = MATERIALS[material];
    this.dt = timeStep(cell);
    const mesh = buildMesh(scene, seed, cell);
    this.x = mesh.x;
    this.y = mesh.y;
    this.tri = mesh.tri;
    this.nodeCount = mesh.x.length;
    this.triCount = mesh.tri.length / 3;
    this.vx = new Float64Array(this.nodeCount);
    this.vy = new Float64Array(this.nodeCount);
    this.fx = new Float64Array(this.nodeCount);
    this.fy = new Float64Array(this.nodeCount);
    this.mass = new Float64Array(this.nodeCount);
    this.nodeRefs = new Int32Array(this.nodeCount);
    this.restInverse = new Float64Array(4 * this.triCount);
    this.plasticInverse = new Float64Array(4 * this.triCount);
    this.restArea = new Float64Array(this.triCount);
    this.plasticStrain = new Float64Array(this.triCount);
    this.damage = new Float64Array(this.triCount);
    this.stressRatio = new Float64Array(this.triCount);
    this.alive = new Uint8Array(this.triCount).fill(1);
    this.chunkOf = new Int32Array(this.triCount);
    this.initElements();
    this.refreshChunks();
  }

  private initElements(): void {
    const rest = restShape({ x: this.x, y: this.y, tri: this.tri });
    this.restInverse.set(rest.inverse);
    this.restArea.set(rest.area);
    for (let e = 0; e < this.triCount; e++) {
      this.plasticInverse.set([1, 0, 0, 1], 4 * e);
      for (let k = 0; k < 3; k++) {
        const n = atInt(this.tri, 3 * e + k);
        this.mass[n] =
          at(this.mass, n) + (this.material.density * at(rest.area, e)) / 3;
        this.nodeRefs[n] = atInt(this.nodeRefs, n) + 1;
      }
    }
  }

  step(dt = this.dt): void {
    this.fx.fill(0);
    this.fy.fill(0);
    const eroded = addElementForces(this, this.material, dt);
    this.erodedCount += eroded;
    for (let n = 0; n < this.nodeCount; n++) {
      this.fy[n] = at(this.fy, n) - at(this.mass, n) * GRAVITY;
    }
    for (const ball of this.balls) collideBall(this, ball, dt);
    if (this.grab !== null) addGrabForce(this, this.grab);

    const drag = Math.exp(-AIR_DRAG * dt);
    for (let n = 0; n < this.nodeCount; n++) {
      if (atInt(this.nodeRefs, n) === 0) continue;
      const inverseMass = 1 / at(this.mass, n);
      this.vx[n] = (at(this.vx, n) + dt * at(this.fx, n) * inverseMass) * drag;
      this.vy[n] = (at(this.vy, n) + dt * at(this.fy, n) * inverseMass) * drag;
      this.x[n] = at(this.x, n) + dt * at(this.vx, n);
      this.y[n] = at(this.y, n) + dt * at(this.vy, n);
    }
    collideBounds(this, this.width);
    for (const ball of this.balls) stepBall(ball, this.width, dt);
    this.time += dt;
  }

  /** Adds a ball, dropping the oldest once there are too many. */
  throwBall(x: number, y: number, vx: number, vy: number): void {
    this.balls.push(makeBall(x, y, vx, vy));
    if (this.balls.length > MAX_BALLS) this.balls.shift();
  }

  blast(x: number, y: number): void {
    applyBlast(this, x, y, BLAST_RADIUS, BLAST_SPEED);
  }

  startGrab(x: number, y: number): boolean {
    const nodes: number[] = [];
    for (let n = 0; n < this.nodeCount; n++) {
      if (
        atInt(this.nodeRefs, n) > 0 &&
        Math.hypot(at(this.x, n) - x, at(this.y, n) - y) < GRAB_RADIUS
      ) {
        nodes.push(n);
      }
    }
    if (nodes.length === 0) return false;
    this.grab = {
      points: nodes.map((node) => ({
        node,
        offsetX: at(this.x, node) - x,
        offsetY: at(this.y, node) - y,
      })),
      targetX: x,
      targetY: y,
    };
    return true;
  }

  moveGrab(x: number, y: number): void {
    if (this.grab === null) return;
    this.grab.targetX = x;
    this.grab.targetY = y;
  }

  endGrab(): void {
    this.grab = null;
  }

  get grabbing(): boolean {
    return this.grab !== null;
  }

  refreshChunks(): void {
    this.chunkCount = labelChunks(
      this.tri,
      this.alive,
      this.nodeCount,
      this.chunkOf,
    );
  }

  stats(): WorldStats {
    let maxPlasticStrain = 0;
    for (let e = 0; e < this.triCount; e++) {
      maxPlasticStrain = Math.max(maxPlasticStrain, at(this.plasticStrain, e));
    }
    return {
      erodedFraction: this.erodedCount / this.triCount,
      chunks: this.chunkCount,
      maxPlasticStrain,
    };
  }
}
