// Small pure helpers for the paper. No React here.
import type { Job, Run, Command, Application } from "../../contract/types";

const FIT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Ads that make it into print: new or ranked, best first. */
export function printableJobs(jobs: Job[]): Job[] {
  return jobs
    .filter((j) => j.status === "new" || j.status === "ranked")
    .slice()
    .sort((a, b) => {
      const ra = a.rankScore ?? -1;
      const rb = b.rankScore ?? -1;
      if (ra !== rb) return rb - ra;
      const fa = FIT_ORDER[a.scrapeFit ?? ""] ?? 3;
      const fb = FIT_ORDER[b.scrapeFit ?? ""] ?? 3;
      if (fa !== fb) return fa - fb;
      return (b.firstSeen ?? "").localeCompare(a.firstSeen ?? "");
    });
}

export function isActive(run: Run | null | undefined): boolean {
  return !!run && (run.status === "queued" || run.status === "running" || run.status === "waiting_input");
}

export function isFinished(run: Run | null | undefined): boolean {
  return !!run && (run.status === "done" || run.status === "failed" || run.status === "cancelled");
}

const WORDS: Record<Command, string> = {
  setup: "Setting up your subscription",
  scrape: "Fetching today's paper",
  rank: "Reading the ads closely",
  apply: "Typing up your application",
  outcome: "Noting a reply",
  "gmail-sync": "Checking the mailbox",
  interview: "Interview practice",
  upskill: "The self-improvement column",
};
export const commandWords = (c: Command): string => WORDS[c] ?? c;

export function stampText(app: Application): string {
  switch (app.status) {
    case "drafted": return "DRAFTED";
    case "applied": return "SENT";
    case "interview": return "INTERVIEW";
    case "offer": return "OFFER";
    default: return String(app.status).replace(/_/g, " ").toUpperCase();
  }
}

export function todayLine(d = new Date()): string {
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/** Deterministic 0..1 generator seeded from a string, so an ad's circle keeps its shape. */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A hand-drawn loop around a w x h box, in pixel coordinates.
 * Superellipse (hugs corners better than an ellipse, so 6-line ads stay inside)
 * with gentle radius wobble and an overshoot so the pen's ends overlap.
 */
export function handLoopPath(w: number, h: number, seed: string): string {
  const rnd = seeded(seed);
  const cx = w / 2, cy = h / 2;
  const rx = w / 2 - 2, ry = h / 2 - 2;
  const n = 2.8; // superellipse exponent
  const start = -Math.PI * (0.55 + rnd() * 0.2); // start top-left-ish, like a right-handed pen
  const sweep = Math.PI * 2 * (1.06 + rnd() * 0.05);
  const steps = 28;
  const pts: [number, number][] = [];
  const wob = 0.025;
  for (let i = 0; i <= steps; i++) {
    const t = start + (sweep * i) / steps;
    const c = Math.cos(t), s = Math.sin(t);
    const k = 1 + (rnd() - 0.5) * 2 * wob + (i / steps) * 0.03; // spirals out a touch at the end
    const x = cx + rx * k * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = cy + ry * k * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    pts.push([x, y]);
  }
  // Catmull-Rom -> cubic Bezier
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Split an ordered list into two columns of roughly equal estimated height, keeping reading order. */
export function balanceColumns<T>(items: T[], weight: (t: T) => number): [T[], T[]] {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let acc = 0;
  let cut = items.length;
  for (let i = 0; i < items.length; i++) {
    const w = weight(items[i]);
    if (acc + w / 2 > total / 2) { cut = i; break; }
    acc += w;
  }
  return [items.slice(0, cut), items.slice(cut)];
}

export function adWeight(j: Job): number {
  return 3 + Math.ceil(j.title.length / 28) + (j.strengths[0] ? 1.5 : 0) + (j.application ? 1 : 0);
}
