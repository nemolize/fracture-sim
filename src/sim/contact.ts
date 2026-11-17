import { at, atInt } from "./array";
import type { Solid } from "./solid";

export const GRAVITY = 9.8;

export const FLOOR_FRICTION = 0.6;
export const FLOOR_RESTITUTION = 0.1;
export const CONTACT_STIFFNESS = 2e4;
export const CONTACT_DAMPING = 14;
export const BALL_RESTITUTION = 0.3;
export const GRAB_STIFFNESS = 1500;
export const GRAB_DAMPING = 54;
export const GRAB_RADIUS = 0.3;

export const AIR_DRAG = 0.5;
/** Balls on screen at once; throwing another drops the oldest. */
export const MAX_BALLS = 8;
const BALL_RADIUS = 0.25;
const BALL_DENSITY = 10;
/** Blast parameters of the Blast tool. */
export const BLAST_RADIUS = 1.2;
export const BLAST_SPEED = 30;

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
}

export const makeBall = (
  x: number,
  y: number,
  vx: number,
  vy: number,
): Ball => ({
  x,
  y,
  vx,
  vy,
  radius: BALL_RADIUS,
  mass: BALL_DENSITY * Math.PI * BALL_RADIUS * BALL_RADIUS,
});

export interface Grab {
  /** Each node with its position minus the pointer at the moment of the grab. */
  points: { node: number; offsetX: number; offsetY: number }[];
  targetX: number;
  targetY: number;
}

/** Keeps live nodes inside the walls and above the floor, with Coulomb friction. */
export const collideBounds = (solid: Solid, width: number): void => {
  const { x, y, vx, vy } = solid;
  for (let n = 0; n < solid.nodeCount; n++) {
    if (atInt(solid.nodeRefs, n) === 0) continue;
    if (at(x, n) < 0) {
      x[n] = 0;
      vx[n] = Math.max(at(vx, n), 0);
    } else if (at(x, n) > width) {
      x[n] = width;
      vx[n] = Math.min(at(vx, n), 0);
    }
    if (at(y, n) < 0) {
      y[n] = 0;
      if (at(vy, n) < 0) {
        const impulse = -at(vy, n) * (1 + FLOOR_RESTITUTION);
        vy[n] = at(vy, n) + impulse;
        const slide = Math.min(Math.abs(at(vx, n)), FLOOR_FRICTION * impulse);
        vx[n] = at(vx, n) - Math.sign(at(vx, n)) * slide;
      }
    }
  }
};

/**
 * Penalty contact between a ball and the nodes; the reaction goes to the ball.
 * Every node sees the ball velocity from the start of the step, so the result
 * does not depend on the order of the nodes.
 */
export const collideBall = (solid: Solid, ball: Ball, dt: number): void => {
  const { x, y, vx, vy, fx, fy, mass } = solid;
  const ballVx = ball.vx;
  const ballVy = ball.vy;
  for (let n = 0; n < solid.nodeCount; n++) {
    if (atInt(solid.nodeRefs, n) === 0) continue;
    const dx = at(x, n) - ball.x;
    const dy = at(y, n) - ball.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= ball.radius || distance === 0) continue;
    const nx = dx / distance;
    const ny = dy / distance;
    const closing = -((at(vx, n) - ballVx) * nx + (at(vy, n) - ballVy) * ny);
    const push =
      CONTACT_STIFFNESS * (ball.radius - distance) +
      (closing > 0 ? CONTACT_DAMPING * closing * Math.sqrt(at(mass, n)) : 0);
    fx[n] = at(fx, n) + push * nx;
    fy[n] = at(fy, n) + push * ny;
    ball.vx -= (push * nx * dt) / ball.mass;
    ball.vy -= (push * ny * dt) / ball.mass;
  }
};

export const stepBall = (ball: Ball, width: number, dt: number): void => {
  ball.vy -= GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.y < ball.radius) {
    ball.y = ball.radius;
    if (ball.vy < 0) ball.vy *= -BALL_RESTITUTION;
    ball.vx *= 1 - 2 * dt;
  }
  if (ball.x < ball.radius) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx) * BALL_RESTITUTION;
  } else if (ball.x > width - ball.radius) {
    ball.x = width - ball.radius;
    ball.vx = -Math.abs(ball.vx) * BALL_RESTITUTION;
  }
};

/** Pulls the grabbed nodes toward the pointer with a damped spring per unit mass. */
export const addGrabForce = (solid: Solid, grab: Grab): void => {
  for (const { node: n, offsetX, offsetY } of grab.points) {
    if (atInt(solid.nodeRefs, n) === 0) continue;
    const pullX = grab.targetX + offsetX - at(solid.x, n);
    const pullY = grab.targetY + offsetY - at(solid.y, n);
    solid.fx[n] =
      at(solid.fx, n) +
      at(solid.mass, n) *
        (GRAB_STIFFNESS * pullX - GRAB_DAMPING * at(solid.vx, n));
    solid.fy[n] =
      at(solid.fy, n) +
      at(solid.mass, n) *
        (GRAB_STIFFNESS * pullY - GRAB_DAMPING * at(solid.vy, n));
  }
};

/** Radial velocity kick with quadratic falloff. */
export const applyBlast = (
  solid: Solid,
  cx: number,
  cy: number,
  radius: number,
  speed: number,
): void => {
  for (let n = 0; n < solid.nodeCount; n++) {
    if (atInt(solid.nodeRefs, n) === 0) continue;
    const dx = at(solid.x, n) - cx;
    const dy = at(solid.y, n) - cy;
    const distance = Math.hypot(dx, dy);
    if (distance >= radius) continue;
    const falloff = (1 - distance / radius) ** 2;
    const nx = distance > 0 ? dx / distance : 0;
    const ny = distance > 0 ? dy / distance : 1;
    solid.vx[n] = at(solid.vx, n) + speed * falloff * nx;
    solid.vy[n] = at(solid.vy, n) + speed * falloff * ny;
  }
};
