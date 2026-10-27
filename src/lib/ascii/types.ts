export interface Pointer {
  /** position in grid cells */
  x: number;
  y: number;
  /** velocity in cells/second (smoothed) */
  vx: number;
  vy: number;
  down: boolean;
  /** true for exactly one step after a click */
  clicked: boolean;
}

export interface Sim {
  resize(cols: number, rows: number): void;
  step(dt: number, p: Pointer): void;
  /** glyph per cell (char code), 0 = blank */
  code: Uint16Array;
  /** 0..1 per cell */
  alpha: Float32Array;
  /** 1 = draw in accent colour instead of foreground */
  tint?: Uint8Array;
}
