// GPUBufferUsage flag values from the WebGPU specification.
export const BufferUsage = {
  COPY_DST: 0x8,
  VERTEX: 0x20,
  UNIFORM: 0x40,
  STORAGE: 0x80,
} as const;
