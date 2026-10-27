import type { Pointer, Sim } from "./types";

const FONT_PX = 14;
const BUCKETS = 8;
/** Peak opacity: low enough that body text stays readable on top. */
const MAX_ALPHA = 0.2;
const IDLE_MS = 3500;

/** Mounts a sim on a canvas, returns a cleanup function. */
export function mount(canvas: HTMLCanvasElement, sim: Sim): () => void {
  const ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const font = `${FONT_PX}px "Fira Code", monospace`;

  let cw = 8;
  let ch = 17;
  let cols = 0;
  let rows = 0;
  let bucket = new Uint8Array(0);
  const lut: string[] = [];

  const ptr: Pointer = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    down: false,
    clicked: false,
  };
  let lastMove = -Infinity;
  let ghostClick = 0;
  let prevX = 0;
  let prevY = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth;
    const h = innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = font;
    cw = ctx.measureText("M").width || 8;
    ch = Math.round(FONT_PX * 1.2);
    cols = Math.max(8, Math.floor(w / cw));
    rows = Math.max(8, Math.floor(h / ch));
    bucket = new Uint8Array(cols * rows);
    sim.resize(cols, rows);
  }

  function onMove(e: PointerEvent) {
    const nx = e.clientX / cw;
    const ny = e.clientY / ch;
    const now = performance.now();
    const dt = Math.max((now - lastMove) / 1000, 0.001);
    if (now - lastMove < IDLE_MS) {
      const k = 0.35;
      ptr.vx += ((nx - ptr.x) / dt - ptr.vx) * k;
      ptr.vy += ((ny - ptr.y) / dt - ptr.vy) * k;
    }
    ptr.x = nx;
    ptr.y = ny;
    lastMove = now;
  }
  function onDown(e: PointerEvent) {
    if ((e.target as Element | null)?.closest("a,button,input,select")) return;
    ptr.down = true;
    ptr.clicked = true;
    onMove(e);
  }
  function onUp() {
    ptr.down = false;
  }

  addEventListener("resize", resize);
  addEventListener("pointermove", onMove);
  addEventListener("pointerdown", onDown);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);

  /** Lissajous cursor so the page is alive when nobody is touching it. */
  function ghost(t: number) {
    const gx =
      cols * (0.5 + 0.34 * Math.sin(t * 0.37) + 0.1 * Math.sin(t * 0.91));
    const gy =
      rows * (0.5 + 0.3 * Math.sin(t * 0.53 + 1) + 0.08 * Math.cos(t * 1.3));
    ptr.vx = (gx - prevX) / 0.016;
    ptr.vy = (gy - prevY) / 0.016;
    ptr.x = gx;
    ptr.y = gy;
    if (t - ghostClick > 7) {
      ghostClick = t;
      ptr.clicked = true;
    }
  }

  function draw() {
    const style = getComputedStyle(document.documentElement);
    const colours = [
      style.getPropertyValue("--foreground").trim() || "#888",
      style.getPropertyValue("--accent").trim() || "#fa0",
    ];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textBaseline = "top";

    const n = cols * rows;
    const { code, alpha, tint } = sim;
    for (let k = 0; k < n; k++) {
      const a = alpha[k];
      bucket[k] =
        code[k] === 0 || a <= 0.01
          ? 0
          : Math.min(BUCKETS, Math.ceil(a * BUCKETS));
    }
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = colours[c];
      for (let b = 1; b <= BUCKETS; b++) {
        ctx.globalAlpha = (MAX_ALPHA * b) / BUCKETS;
        for (let k = 0; k < n; k++) {
          if (bucket[k] !== b || (tint ? tint[k] : 0) !== c) continue;
          const cc = code[k];
          const s = lut[cc] ?? (lut[cc] = String.fromCharCode(cc));
          ctx.fillText(s, (k % cols) * cw, Math.floor(k / cols) * ch);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  let raf = 0;
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    prevX = ptr.x;
    prevY = ptr.y;
    if (now - lastMove > IDLE_MS) ghost(now / 1000);
    sim.step(dt, ptr);
    ptr.clicked = false;
    draw();
    raf = requestAnimationFrame(frame);
  }

  resize();
  if (reduced) {
    // settle for a couple of seconds, then show a still frame
    for (let i = 0; i < 120; i++) {
      ghost(i / 30);
      sim.step(1 / 30, ptr);
      ptr.clicked = false;
    }
    draw();
  } else {
    raf = requestAnimationFrame(frame);
  }

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerdown", onDown);
    removeEventListener("pointerup", onUp);
    removeEventListener("pointercancel", onUp);
  };
}
