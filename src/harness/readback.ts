import { BufferUsage, MapMode } from "@/gpu/usage";

/**
 * Copies a texture to the CPU as tightly packed rows of 4-byte pixels. The
 * copy is submitted before the first await, so a canvas texture is still the
 * current one when it runs.
 */
export const readTexture = async (
  device: GPUDevice,
  texture: GPUTexture,
  width: number,
  height: number,
): Promise<Uint8Array> => {
  const rowBytes = Math.ceil((4 * width) / 256) * 256;
  const staging = device.createBuffer({
    size: rowBytes * height,
    usage: BufferUsage.MAP_READ | BufferUsage.COPY_DST,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture },
    { buffer: staging, bytesPerRow: rowBytes },
    { width, height },
  );
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(MapMode.READ);
  const mapped = new Uint8Array(staging.getMappedRange());
  const pixels = new Uint8Array(4 * width * height);
  for (let row = 0; row < height; row++) {
    pixels.set(
      mapped.subarray(row * rowBytes, row * rowBytes + 4 * width),
      4 * width * row,
    );
  }
  staging.unmap();
  staging.destroy();
  return pixels;
};
