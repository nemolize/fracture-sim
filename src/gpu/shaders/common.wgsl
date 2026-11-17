// Records shared by every pass. `layout.ts` packs the records and `params.ts` packs `Params`.
struct Params {
  dt: f32,
  drag: f32,
  width: f32,
  ballCount: u32,
  nodeCount: u32,
  triCount: u32,
  grabActive: u32,
  blastRadius: f32,
  grabTarget: vec2<f32>,
  blastCenter: vec2<f32>,
  blastSpeed: f32,
  gravity: vec2<f32>,
}

struct Material {
  mu: f32,
  lambda: f32,
  viscosity: f32,
  yieldStress: f32,
  hardening: f32,
  strength: f32,
  damageRate: f32,
  plasticDamage: f32,
  density: f32,
}

struct Node {
  pos: vec2<f32>,
  vel: vec2<f32>,
  grabOffset: vec2<f32>,
  grabbed: f32,
  // Live triangles touching the node; 0 means it has left the simulation.
  refs: u32,
}

struct ElemStatic {
  restInverse: vec4<f32>,
  tri: vec3<u32>,
  area: f32,
}

struct ElemState {
  plasticInverse: vec4<f32>,
  plasticStrain: f32,
  damage: f32,
  stressRatio: f32,
  alive: u32,
}

struct Ball {
  pos: vec2<f32>,
  vel: vec2<f32>,
  radius: f32,
  mass: f32,
  // Pads the record to 32 bytes, the stride `packBall` and `RECORD_BYTES` use.
  pad: vec2<f32>,
}
