// motion.ts: a small motion engine for the diner, ported for the web from
// rossark-motion-skill's templates/react-native/motion.ts (MIT, rossark0).
// Everything that moves reads a clock; values come from tracks and shaping helpers.

const cb = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;

/** A CSS-style cubic-bezier easing, solved by bisection. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  return (p: number): number => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let lo = 0, hi = 1, t = p;
    for (let i = 0; i < 24; i++) {
      const x = cb(t, x1, x2);
      if (Math.abs(x - p) < 1e-5) break;
      if (x < p) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return cb(t, y1, y2);
  };
}

/** Things that travel (a door swinging, a turn). */
export const EASE_IN_OUT = bezier(0.77, 0, 0.175, 1);
/** Things that open or arrive (a hop landing, a prop appearing). */
export const EASE_OUT = bezier(0.23, 1, 0.32, 1);
/** Only for things falling away. */
export const EASE_IN = bezier(0.55, 0, 1, 0.45);

export type Key = readonly [number, number, "out"?];

/** One move: eases in and out of every key (or eases out when the arriving key says 'out'). */
export function track(t: number, keys: readonly Key[]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const span = k1[0] - k0[0];
      const p = span > 0 ? (t - k0[0]) / span : 1;
      const e = k1[2] === "out" ? EASE_OUT(p) : EASE_IN_OUT(p);
      return k0[1] + (k1[1] - k0[1]) * e;
    }
  }
  return keys[keys.length - 1][1];
}

export type FlowKey = readonly [number, number];

/** A path through key poses with continuous speed (monotone cubic): no stop at each key. */
export function flow(t: number, k: readonly FlowKey[]): number {
  const n = k.length;
  if (t <= k[0][0]) return k[0][1];
  if (t >= k[n - 1][0]) return k[n - 1][1];
  let i = 0;
  while (k[i + 1][0] < t) i++;
  const slope = (j: number) => (k[j + 1][1] - k[j][1]) / (k[j + 1][0] - k[j][0]);
  const tangent = (j: number) => {
    if (j === 0 || j === n - 1) return 0;
    const a = slope(j - 1), b = slope(j);
    if (a * b <= 0) return 0;
    const h0 = k[j][0] - k[j - 1][0], h1 = k[j + 1][0] - k[j][0];
    const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / a + w1 / b);
  };
  const h = k[i + 1][0] - k[i][0];
  const s = (t - k[i][0]) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * k[i][1] + (s3 - 2 * s2 + s) * h * tangent(i)
    + (-2 * s3 + 3 * s2) * k[i + 1][1] + (s3 - s2) * h * tangent(i + 1);
}

/** 0 -> 1 inside the window [a, b], eased; 0 before, 1 after. One beat of a scene. */
export function seg(t: number, a: number, b: number, curve: "out" | "inOut" | "in" = "out"): number {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const p = (t - a) / (b - a);
  return curve === "out" ? EASE_OUT(p) : curve === "in" ? EASE_IN(p) : EASE_IN_OUT(p);
}

/** A smooth -1..1 wave. */
export const wave = (t: number, period: number, phase = 0) => Math.sin((t / period + phase) * Math.PI * 2);

export const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
