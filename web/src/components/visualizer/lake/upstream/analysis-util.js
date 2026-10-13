// Shared numeric helpers for the analysis modules (no imports: safe from both sides).
export const percentile = (arr, p) => {
  const s = Float32Array.from(arr).sort(), k = (s.length - 1) * p / 100, i = Math.floor(k), j = Math.min(s.length - 1, i + 1);
  return s[i] + (s[j] - s[i]) * (k - i);
};
