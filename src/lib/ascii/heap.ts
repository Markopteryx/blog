import type { Sim } from "./types";

interface Block {
  start: number;
  len: number;
  ttl: number;
  hl: number;
}

const HEX = "0123456789abcdef";
const DOT = ".".charCodeAt(0);

/**
 * A memory arena with a next-fit allocator whose rover is the cursor.
 * Moving mallocs, time frees, clicking compacts (one memmove at a time).
 */
export function heap(): Sim {
  let cols = 0;
  let rows = 0;
  let owner = new Int32Array(0); // 0 = free, else block id
  const blocks = new Map<number, Block>();
  let nextId = 1;
  let allocDebt = 0;
  let compacting = false;
  let compactClock = 0;
  let oom = 0;

  function alloc(size: number, from: number): boolean {
    const n = owner.length;
    let run = 0;
    for (let off = 0; off < n; off++) {
      const k = (from + off) % n;
      // runs may not wrap around the end of the arena
      if (k === 0) run = 0;
      if (owner[k] === 0) {
        run++;
        if (run === size) {
          const start = k - size + 1;
          const id = nextId++;
          owner.fill(id, start, start + size);
          blocks.set(id, {
            start,
            len: size,
            ttl: 3 + Math.random() * 9,
            hl: 0.4,
          });
          return true;
        }
      } else {
        run = 0;
      }
    }
    return false;
  }

  function release(id: number) {
    const b = blocks.get(id);
    if (!b) return;
    owner.fill(0, b.start, b.start + b.len);
    blocks.delete(id);
  }

  /** memmove the lowest block that has a hole below it. */
  function compactOne(): boolean {
    const hole = owner.indexOf(0);
    if (hole < 0) return false;
    let best: Block | undefined;
    let bestId = 0;
    for (const [id, b] of blocks) {
      if (b.start > hole && (!best || b.start < best.start)) {
        best = b;
        bestId = id;
      }
    }
    if (!best) return false;
    // slide left to the first hole (overlapping copy, like memmove)
    owner.fill(0, best.start, best.start + best.len);
    owner.fill(bestId, hole, hole + best.len);
    best.start = hole;
    best.hl = 0.5;
    return true;
  }

  const sim: Sim = {
    code: new Uint16Array(0),
    alpha: new Float32Array(0),
    tint: new Uint8Array(0),
    resize(c, r) {
      cols = c;
      rows = r;
      owner = new Int32Array(c * r);
      blocks.clear();
      sim.code = new Uint16Array(c * r);
      sim.alpha = new Float32Array(c * r);
      sim.tint = new Uint8Array(c * r);
    },
    step(dt, p) {
      const rover =
        Math.min(rows - 1, Math.max(0, Math.floor(p.y))) * cols +
        Math.min(cols - 1, Math.max(0, Math.floor(p.x)));
      const speed = Math.hypot(p.vx, p.vy * 2);

      if (p.clicked) compacting = true;

      if (!compacting) {
        allocDebt += dt * Math.min(speed * 0.6, 30);
        while (allocDebt >= 1) {
          allocDebt--;
          const size = 2 + Math.floor(Math.random() * Math.random() * 16);
          if (!alloc(size, rover)) {
            oom = 1;
            // out of memory: the "OOM killer" frees a few random blocks
            const ids = [...blocks.keys()];
            for (let i = 0; i < 6 && ids.length; i++)
              release(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
          }
        }
      } else {
        compactClock += dt;
        while (compactClock > 0.03) {
          compactClock -= 0.03;
          if (!compactOne()) {
            compacting = false;
            break;
          }
        }
      }

      oom = Math.max(0, oom - dt * 2);
      for (const [id, b] of blocks) {
        b.hl = Math.max(0, b.hl - dt);
        if (!compacting) {
          b.ttl -= dt;
          if (b.ttl <= 0) release(id);
        }
      }

      for (let k = 0; k < owner.length; k++) {
        const id = owner[k];
        if (id === 0) {
          sim.code[k] = DOT;
          sim.alpha[k] = 0.1;
          sim.tint![k] = 0;
          continue;
        }
        const b = blocks.get(id)!;
        const first = k === b.start;
        const last = k === b.start + b.len - 1;
        const ch = b.len === 1 ? "#" : first ? "[" : last ? "]" : HEX[id % 16];
        sim.code[k] = ch.charCodeAt(0);
        sim.alpha[k] = first || last ? 0.7 : 0.4;
        sim.tint![k] = b.hl > 0 ? 1 : 0;
      }
      sim.code[rover] = "^".charCodeAt(0);
      sim.alpha[rover] = 1;
      sim.tint![rover] = 1;
      if (oom > 0.05) {
        for (let k = 0; k < cols; k++) {
          sim.alpha[k] = Math.max(sim.alpha[k], oom);
          sim.tint![k] = 1;
        }
      }
    },
  };
  return sim;
}
