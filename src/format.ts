export const formatNumber = (value: number): string =>
  value.toLocaleString("en-US", { maximumSignificantDigits: 5 });
