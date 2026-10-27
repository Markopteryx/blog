export const RAMP = " .:-=+*#%@";

export const codes = (s: string) => Uint16Array.from(s, c => c.charCodeAt(0));

export const clamp = (x: number, a: number, b: number) =>
  x < a ? a : x > b ? b : x;

/** Add a gaussian bump to a field. Cells are twice as tall as wide. */
export function splat(
  f: Float32Array,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  amp: number,
  sigma: number
) {
  const r = Math.ceil(sigma * 3);
  const inv = 1 / (2 * sigma * sigma);
  const y0 = Math.max(0, Math.floor(cy - r / 2));
  const y1 = Math.min(rows - 1, Math.ceil(cy + r / 2));
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(cols - 1, Math.ceil(cx + r));
  for (let j = y0; j <= y1; j++) {
    for (let i = x0; i <= x1; i++) {
      const dx = i + 0.5 - cx;
      const dy = (j + 0.5 - cy) * 2;
      f[j * cols + i] += amp * Math.exp(-(dx * dx + dy * dy) * inv);
    }
  }
}
