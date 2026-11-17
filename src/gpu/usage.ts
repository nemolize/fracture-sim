// The WebGPU flag values, which lib.dom declares no globals for. Numbers from
// the WebGPU specification (GPUBufferUsage, GPUShaderStage, GPUMapMode,
// GPUTextureUsage).

export const BufferUsage = {
  MAP_READ: 0x1,
  COPY_SRC: 0x4,
  COPY_DST: 0x8,
  UNIFORM: 0x40,
  STORAGE: 0x80,
} as const;

export const ShaderStage = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
} as const;

export const MapMode = { READ: 0x1 } as const;

export const TextureUsage = {
  COPY_SRC: 0x1,
  RENDER_ATTACHMENT: 0x10,
} as const;
