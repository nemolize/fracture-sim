// Per-node update: gathers the triangle forces, then applies gravity, ball
// contact, the grab spring, drag, integration and the walls and floor.
// Mirrors the node half of `World.step`. Each node also writes the contact
// force it exerted on every ball, which `balls.wgsl` sums.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<uniform> material: Material;
@group(0) @binding(2) var<storage, read_write> nodes: array<Node>;
@group(0) @binding(3) var<storage, read> elemStatic: array<ElemStatic>;
@group(0) @binding(4) var<storage, read> elemState: array<ElemState>;
@group(0) @binding(5) var<storage, read> elemForce: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> adjacency: array<u32>;
@group(0) @binding(7) var<storage, read> balls: array<Ball>;
@group(0) @binding(8) var<storage, read_write> ballPush: array<vec2<f32>>;

@compute @workgroup_size(64)
fn nodeStep(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = gid.x;
  if (n >= params.nodeCount) { return; }
  var node = nodes[n];

  // Triangles come and go through erosion, so refs and mass are rebuilt from the live ones.
  var refs = 0u;
  var mass = 0.0;
  var force = vec2<f32>(0.0);
  for (var k = adjacency[n]; k < adjacency[n + 1u]; k++) {
    let code = adjacency[k];
    let e = code / 3u;
    if (elemState[e].alive == 0u) { continue; }
    refs++;
    mass += material.density * elemStatic[e].area / 3.0;
    let h = elemForce[e];
    let corner = code % 3u;
    if (corner == 0u) {
      force -= vec2<f32>(h.x + h.z, h.y + h.w);
    } else if (corner == 1u) {
      force += vec2<f32>(h.x, h.y);
    } else {
      force += vec2<f32>(h.z, h.w);
    }
  }
  node.refs = refs;
  if (refs == 0u) {
    node.vel = vec2<f32>(0.0);
    nodes[n] = node;
    for (var b = 0u; b < params.ballCount; b++) {
      ballPush[n * MAX_BALLS + b] = vec2<f32>(0.0);
    }
    return;
  }

  force.y -= mass * GRAVITY;

  // Penalty contact against every ball, at the ball's start-of-step state.
  for (var b = 0u; b < params.ballCount; b++) {
    let ball = balls[b];
    let offset = node.pos - ball.pos;
    let distance = length(offset);
    var push = vec2<f32>(0.0);
    if (distance < ball.radius && distance > 0.0) {
      let normal = offset / distance;
      let closing = -dot(node.vel - ball.vel, normal);
      let magnitude = CONTACT_STIFFNESS * (ball.radius - distance)
        + select(0.0, CONTACT_DAMPING * closing * sqrt(mass), closing > 0.0);
      push = magnitude * normal;
    }
    force += push;
    ballPush[n * MAX_BALLS + b] = push;
  }

  if (params.grabActive == 1u && node.grabbed > 0.5) {
    let pull = params.grabTarget + node.grabOffset - node.pos;
    force += mass * (GRAB_STIFFNESS * pull - GRAB_DAMPING * node.vel);
  }

  node.vel = (node.vel + params.dt * force / mass) * params.drag;
  node.pos += params.dt * node.vel;

  if (node.pos.x < 0.0) {
    node.pos.x = 0.0;
    node.vel.x = max(node.vel.x, 0.0);
  } else if (node.pos.x > params.width) {
    node.pos.x = params.width;
    node.vel.x = min(node.vel.x, 0.0);
  }
  if (node.pos.y < 0.0) {
    node.pos.y = 0.0;
    if (node.vel.y < 0.0) {
      let impulse = -node.vel.y * (1.0 + FLOOR_RESTITUTION);
      node.vel.y += impulse;
      let slide = min(abs(node.vel.x), FLOOR_FRICTION * impulse);
      node.vel.x -= sign(node.vel.x) * slide;
    }
  }
  nodes[n] = node;
}
