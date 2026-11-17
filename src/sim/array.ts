/* v8 ignore file -- @preserve */
/*
 * Hot-loop reads of typed arrays under `noUncheckedIndexedAccess`; indices are
 * always in range, so the `?? 0` fallbacks are unreachable. One helper per array type: a shared one sees three element
 * kinds at every call site and V8 stops specialising the loads.
 */
export const at = (array: Float64Array, index: number): number =>
  array[index] ?? 0;
export const atInt = (array: Int32Array, index: number): number =>
  array[index] ?? 0;
export const atByte = (array: Uint8Array, index: number): number =>
  array[index] ?? 0;
export const atF32 = (array: Float32Array, index: number): number =>
  array[index] ?? 0;
export const atU32 = (array: Uint32Array, index: number): number =>
  array[index] ?? 0;
