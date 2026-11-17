// The body as one flat-coloured triangle per element, then balls and flat
// shapes (floor, aim line). Positions are mapped from world metres to canvas
// pixels exactly as the 2D renderer did: y up, floor line `floorPixel` rows down.

struct View {
  size: vec2<f32>,
  scale: f32,
  floorPixel: f32,
  baseColor: vec4<f32>,
  mode: u32,
}

struct Shape {
  a: vec2<f32>,
  b: vec2<f32>,
  color: vec4<f32>,
  halfWidth: f32,
}

@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;
@group(0) @binding(2) var<storage, read> elemStatic: array<ElemStatic>;
@group(0) @binding(3) var<storage, read> elemState: array<ElemState>;
@group(0) @binding(4) var<storage, read> chunkOf: array<i32>;
@group(0) @binding(5) var<storage, read> balls: array<Ball>;
@group(0) @binding(6) var<storage, read> shapes: array<Shape>;

var<private> CORNERS = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
  vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
);
const BALL_COLOR = vec3<f32>(0.1216, 0.1608, 0.2157);
const OFFSCREEN = vec4<f32>(2.0, 2.0, 2.0, 1.0);

fn pixelToClip(pixel: vec2<f32>) -> vec4<f32> {
  return vec4<f32>(pixel.x / view.size.x * 2.0 - 1.0, 1.0 - pixel.y / view.size.y * 2.0, 0.0, 1.0);
}

fn worldToPixel(point: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(point.x * view.scale, view.floorPixel - point.y * view.scale);
}

// Dark blue through red to yellow; `t` is clamped to 0..1.
fn heat(t: f32) -> vec3<f32> {
  let v = clamp(t, 0.0, 1.0);
  return vec3<f32>(clamp(v * 2.0, 0.0, 1.0), clamp(v * 2.0 - 1.0, 0.0, 1.0), (160.0 / 255.0) * (1.0 - v));
}

// Stable distinct colour per piece id: golden-angle hue steps at 55% saturation, 60% lightness.
fn pieceColor(id: i32) -> vec3<f32> {
  let hue = (f32(id) * 137.508 % 360.0) / 60.0;
  let chroma = 0.44;
  let x = chroma * (1.0 - abs(hue % 2.0 - 1.0));
  var rgb = vec3<f32>(chroma, 0.0, x);
  if (hue < 1.0) { rgb = vec3<f32>(chroma, x, 0.0); }
  else if (hue < 2.0) { rgb = vec3<f32>(x, chroma, 0.0); }
  else if (hue < 3.0) { rgb = vec3<f32>(0.0, chroma, x); }
  else if (hue < 4.0) { rgb = vec3<f32>(0.0, x, chroma); }
  else if (hue < 5.0) { rgb = vec3<f32>(x, 0.0, chroma); }
  return rgb + vec3<f32>(0.38);
}

fn triangleColor(e: u32, state: ElemState) -> vec3<f32> {
  switch view.mode {
    case VIEW_DAMAGE: { return heat(state.damage); }
    case VIEW_PLASTIC: { return heat(state.plasticStrain / PLASTIC_FULL_SCALE); }
    case VIEW_STRESS: { return heat(state.stressRatio); }
    case VIEW_CHUNKS: { return pieceColor(chunkOf[e]); }
    default: {
      // Darken with damage so cracks read before the triangles disappear.
      return min(view.baseColor.rgb * (1.0 - 0.55 * state.damage), vec3<f32>(1.0));
    }
  }
}

struct FlatOut {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(flat) color: vec3<f32>,
  @location(1) local: vec2<f32>,
}

@vertex
fn bodyVertex(@builtin(vertex_index) index: u32) -> FlatOut {
  let e = index / 3u;
  let state = elemState[e];
  var out: FlatOut;
  out.local = vec2<f32>(0.0);
  if (state.alive == 0u) {
    out.position = OFFSCREEN;
    out.color = vec3<f32>(0.0);
    return out;
  }
  let node = nodes[elemStatic[e].tri[index % 3u]];
  out.position = pixelToClip(worldToPixel(node.pos));
  out.color = triangleColor(e, state);
  return out;
}

@vertex
fn ballVertex(@builtin(vertex_index) index: u32, @builtin(instance_index) instance: u32) -> FlatOut {
  let ball = balls[instance];
  var out: FlatOut;
  out.color = BALL_COLOR;
  out.local = CORNERS[index];
  // Inactive slots have radius 0 and collapse to a point.
  let offset = vec2<f32>(out.local.x, -out.local.y) * ball.radius * view.scale;
  out.position = pixelToClip(worldToPixel(ball.pos) + offset);
  return out;
}

@vertex
fn shapeVertex(@builtin(vertex_index) index: u32, @builtin(instance_index) instance: u32) -> FlatOut {
  let shape = shapes[instance];
  var out: FlatOut;
  out.color = shape.color.rgb;
  out.local = vec2<f32>(0.0);
  let along = shape.b - shape.a;
  let span = sqrt(dot(along, along));
  let direction = select(vec2<f32>(1.0, 0.0), along / span, span > 0.0);
  let normal = vec2<f32>(-direction.y, direction.x);
  let corner = CORNERS[index];
  let centre = mix(shape.a, shape.b, (corner.x + 1.0) / 2.0);
  out.position = pixelToClip(centre + normal * shape.halfWidth * corner.y);
  return out;
}

@fragment
fn flatFragment(in: FlatOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color, 1.0);
}

@fragment
fn discFragment(in: FlatOut) -> @location(0) vec4<f32> {
  if (dot(in.local, in.local) > 1.0) { discard; }
  return vec4<f32>(in.color, 1.0);
}
