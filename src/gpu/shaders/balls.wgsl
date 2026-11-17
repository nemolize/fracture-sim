// One workgroup per ball: sums the reaction of every node, applies it, then
// moves the ball like `stepBall`.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> ballPush: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> balls: array<Ball>;

var<workgroup> partial: array<vec2<f32>, BALL_WORKGROUP_SIZE>;

@compute @workgroup_size(BALL_WORKGROUP_SIZE)
fn ballStep(
  @builtin(workgroup_id) workgroup: vec3<u32>,
  @builtin(local_invocation_index) lane: u32,
) {
  let b = workgroup.x;
  var sum = vec2<f32>(0.0);
  for (var n = lane; n < params.nodeCount; n += BALL_WORKGROUP_SIZE) {
    sum += ballPush[n * MAX_BALLS + b];
  }
  partial[lane] = sum;
  workgroupBarrier();
  for (var stride = BALL_WORKGROUP_SIZE / 2u; stride > 0u; stride >>= 1u) {
    if (lane < stride) { partial[lane] += partial[lane + stride]; }
    workgroupBarrier();
  }
  if (lane != 0u) { return; }

  var ball = balls[b];
  ball.vel -= partial[0] * params.dt / ball.mass;
  ball.vel.y -= GRAVITY * params.dt;
  ball.pos += ball.vel * params.dt;
  if (ball.pos.y < ball.radius) {
    ball.pos.y = ball.radius;
    if (ball.vel.y < 0.0) { ball.vel.y *= -BALL_RESTITUTION; }
    ball.vel.x *= 1.0 - BALL_FLOOR_DRAG * params.dt;
  }
  if (ball.pos.x < ball.radius) {
    ball.pos.x = ball.radius;
    ball.vel.x = abs(ball.vel.x) * BALL_RESTITUTION;
  } else if (ball.pos.x > params.width - ball.radius) {
    ball.pos.x = params.width - ball.radius;
    ball.vel.x = -abs(ball.vel.x) * BALL_RESTITUTION;
  }
  balls[b] = ball;
}
