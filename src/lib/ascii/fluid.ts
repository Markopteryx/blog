import type { Sim } from "./types";
import { RAMP, clamp, codes } from "./util";

const glyphs = codes(RAMP);
const ITER = 16;
const BUOYANCY = 22;
const STIR = 0.12;

/** Jos Stam "stable fluids": a flame at the cursor, smoke you can stir. */
export function fluid(): Sim {
  let cols = 0;
  let rows = 0;
  let u = new Float32Array(0);
  let v = new Float32Array(0);
  let u0 = new Float32Array(0);
  let v0 = new Float32Array(0);
  let d = new Float32Array(0);
  let d0 = new Float32Array(0);
  let pr = new Float32Array(0);
  let pr0 = new Float32Array(0);
  let div = new Float32Array(0);
  let t = 0;

  function advect(dst: Float32Array, src: Float32Array, dt: number) {
    for (let j = 1; j < rows - 1; j++) {
      for (let i = 1; i < cols - 1; i++) {
        const k = j * cols + i;
        const x = clamp(i - u[k] * dt, 0.5, cols - 1.5);
        const y = clamp(j - v[k] * dt, 0.5, rows - 1.5);
        const i0 = Math.floor(x);
        const j0 = Math.floor(y);
        const fx = x - i0;
        const fy = y - j0;
        const a = j0 * cols + i0;
        dst[k] =
          (1 - fy) * ((1 - fx) * src[a] + fx * src[a + 1]) +
          fy * ((1 - fx) * src[a + cols] + fx * src[a + cols + 1]);
      }
    }
  }

  // Jacobi (not Gauss-Seidel): in-place sweeps bias the pressure field along
  // the sweep direction, which shows up as a steady sideways drift.
  function project() {
    for (let j = 1; j < rows - 1; j++) {
      for (let i = 1; i < cols - 1; i++) {
        const k = j * cols + i;
        div[k] = -0.5 * (u[k + 1] - u[k - 1] + v[k + cols] - v[k - cols]);
      }
    }
    pr.fill(0);
    pr0.fill(0);
    for (let it = 0; it < ITER; it++) {
      for (let j = 1; j < rows - 1; j++) {
        for (let i = 1; i < cols - 1; i++) {
          const k = j * cols + i;
          pr0[k] =
            (div[k] + pr[k - 1] + pr[k + 1] + pr[k - cols] + pr[k + cols]) / 4;
        }
      }
      [pr, pr0] = [pr0, pr];
    }
    for (let j = 1; j < rows - 1; j++) {
      for (let i = 1; i < cols - 1; i++) {
        const k = j * cols + i;
        u[k] -= 0.5 * (pr[k + 1] - pr[k - 1]);
        v[k] -= 0.5 * (pr[k + cols] - pr[k - cols]);
      }
    }
  }

  const sim: Sim = {
    code: new Uint16Array(0),
    alpha: new Float32Array(0),
    tint: new Uint8Array(0),
    resize(c, r) {
      cols = c;
      rows = r;
      const n = c * r;
      u = new Float32Array(n);
      v = new Float32Array(n);
      u0 = new Float32Array(n);
      v0 = new Float32Array(n);
      d = new Float32Array(n);
      d0 = new Float32Array(n);
      pr = new Float32Array(n);
      pr0 = new Float32Array(n);
      div = new Float32Array(n);
      sim.code = new Uint16Array(n);
      sim.alpha = new Float32Array(n);
      sim.tint = new Uint8Array(n);
    },
    step(dt, p) {
      t += dt;
      const speed = Math.hypot(p.vx, p.vy);
      const burst = p.clicked ? 4 : 1;
      // the cursor is a burner: it always emits, motion only adds a little stir
      const jMax = Math.min(rows - 1, p.y + 3);
      const iMax = Math.min(cols - 1, p.x + 6);
      for (let j = Math.max(1, Math.floor(p.y - 3)); j < jMax; j++) {
        for (let i = Math.max(1, Math.floor(p.x - 6)); i < iMax; i++) {
          const dx = i - p.x;
          const dy = (j - p.y) * 2;
          const wgt = Math.exp(-(dx * dx + dy * dy) / 12);
          const k = j * cols + i;
          u[k] += p.vx * wgt * STIR;
          v[k] += p.vy * wgt * STIR;
          d[k] += wgt * (0.04 + Math.min(speed * 0.004, 0.1)) * burst;
        }
      }

      for (let j = 1; j < rows - 1; j++) {
        for (let i = 1; i < cols - 1; i++) {
          const k = j * cols + i;
          // lift, plus a little turbulence so the plume licks side to side
          v[k] -= d[k] * BUOYANCY * dt;
          u[k] += d[k] * Math.sin(t * 3 + j * 0.4 + i * 0.05) * 6 * dt;
        }
      }

      project();
      advect(u0, u, dt);
      advect(v0, v, dt);
      [u, u0] = [u0, u];
      [v, v0] = [v0, v];
      project();
      advect(d0, d, dt);
      [d, d0] = [d0, d];

      for (let k = 0; k < d.length; k++) {
        u[k] *= 0.99;
        v[k] *= 0.99;
        d[k] = Math.min(d[k] * 0.985, 2);
        const level = Math.min(1, d[k]);
        const idx = Math.floor(level * (RAMP.length - 1));
        sim.code[k] = glyphs[idx];
        sim.alpha[k] = idx === 0 ? 0 : 0.15 + 0.85 * level;
        sim.tint![k] = level > 0.75 ? 1 : 0;
      }
    },
  };
  return sim;
}
