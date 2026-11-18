/* eslint-disable @typescript-eslint/no-non-null-assertion -- The benchmark supplies nonempty samples and a fraction in (0, 1]. */
export const percentile = (
  samples: readonly number[],
  fraction: number,
): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)
  ]!;
};

export const runsOnShared = (
  env: Readonly<Record<string, string | undefined>>,
): boolean => Boolean(env["CI"]);
