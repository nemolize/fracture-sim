// Pointer tools, each one dispatch over the nodes.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> nodes: array<Node>;

// Marks the live nodes under the pointer and remembers where each sits relative to it.
@compute @workgroup_size(WORKGROUP_SIZE)
fn grabStart(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = gid.x;
  if (n >= params.nodeCount) { return; }
  var node = nodes[n];
  let offset = node.pos - params.grabTarget;
  node.grabbed = select(0.0, 1.0, node.refs > 0u && length(offset) < GRAB_RADIUS);
  node.grabOffset = offset;
  nodes[n] = node;
}

// Radial velocity kick with quadratic falloff.
@compute @workgroup_size(WORKGROUP_SIZE)
fn blast(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = gid.x;
  if (n >= params.nodeCount) { return; }
  var node = nodes[n];
  if (node.refs == 0u) { return; }
  let offset = node.pos - params.blastCenter;
  let distance = length(offset);
  if (distance >= params.blastRadius) { return; }
  let remaining = 1.0 - distance / params.blastRadius;
  let direction = select(vec2<f32>(0.0, 1.0), offset / distance, distance > 0.0);
  node.vel += params.blastSpeed * remaining * remaining * direction;
  nodes[n] = node;
}
