import type { Sim } from "./types";

export interface SimInfo {
  slug: "smoke" | "heap";
  load: () => Promise<() => Sim>;
}

export const SIMS: SimInfo[] = [
  { slug: "smoke", load: () => import("./fluid").then(m => m.fluid) },
  { slug: "heap", load: () => import("./heap").then(m => m.heap) },
];
