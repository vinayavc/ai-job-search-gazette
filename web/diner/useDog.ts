// Dog choreography. One mutable "rig" (position, depth, facing, door, paper) is driven
// frame by frame from the motion engine and written straight to the DOM; React only
// re-renders when the pose changes. Positions are measured from the scene, so nothing
// is hard-coded to one screen size. See MOTION.md next to this file.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Run } from "../../contract/types";
import { EASE_IN_OUT, EASE_OUT, flow, reducedMotion, seg, wave, type FlowKey } from "./motion";

export type Pose = "sleep" | "stretch" | "stand" | "run" | "sit" | "type";
export type Mode = "idle" | "out" | "type" | "sit";

export interface DogView { pose: Pose; carrying: boolean; paperKey: number }
export interface DogRefs {
  scene: RefObject<HTMLElement>;
  dog: RefObject<HTMLDivElement>;
  flip: RefObject<HTMLDivElement>;
  panel: RefObject<HTMLDivElement>;
  paper: RefObject<SVGSVGElement>;
}

// Drawing widths (viewBox units) of each pose; every pose is drawn at the same px-per-unit (--k).
export const ART_W = { fetch: 214, sleep: 140, sit: 140, type: 196, stretch: 220 } as const;

// Every tunable number in one place (ms, px).
const T = {
  fade: 220,           // pose cross-fade (CSS)
  stretch: 800,        // play-bow before getting up
  speed: 190,          // trot speed, px/s
  minWalk: 650,
  door: 600,           // door swing
  doorLead: 250,       // door starts opening this long before the dog reaches the sill
  closeAfter: 380,     // door closes this long after the dog is through
  turn: 240,
  hold: 400,           // stand still after arriving
  admire: 1700,        // look at the dropped paper
  failedRest: 2600,
  hop: 560,
  hopArc: 16,
  lieDown: 420,
  bob: 1.1,            // px of trot bob
  sillScale: 0.8,      // further away at the door sill
  paperFade: 500,
  paperLinger: 1400,
};

const ACTIVE = new Set(["queued", "running", "waiting_input"]);
export function modeOf(run: Run | null): Mode {
  if (!run || !ACTIVE.has(run.status)) return "idle";
  if (run.command === "scrape") return "out";
  if (run.command === "apply") return "type";
  return "sit";
}

interface Rig { x: number; lift: number; scale: number; facing: number; show: number; door: number; paperX: number; paper: number }

function measure(scene: HTMLElement, dog: HTMLElement) {
  const s = scene.getBoundingClientRect();
  const inner = { left: s.left + scene.clientLeft, bottom: s.top + scene.clientTop + scene.clientHeight, width: scene.clientWidth };
  const r = (sel: string) => scene.querySelector(sel)!.getBoundingClientRect();
  const door = r(".diner-door"), table = r(".table"), counter = r(".counter");
  const cs = getComputedStyle(dog);
  const k = parseFloat(cs.getPropertyValue("--k")) || 0.56;
  const base = parseFloat(cs.bottom) || 6;
  const floorH = parseFloat(getComputedStyle(scene).getPropertyValue("--floor-h")) || 46;
  const half = (ART_W.fetch * k) / 2;
  const doorIn = door.left - inner.left + 7, doorOut = door.right - inner.left - 7;
  const sillX = doorIn + half * T.sillScale + 6;
  return {
    k, half,
    table: table.left - inner.left + table.width / 2,
    center: inner.width * 0.58,
    sillX,
    goneX: doorOut + half * T.sillScale + 10,
    sill: floorH - base,                         // lift that puts the paws on the door sill
    counterX: counter.left - inner.left + inner.width * 0.015 + (ART_W.type * k) / 2, // left end; the radio slides to the right end
    counterEdge: counter.right - inner.left,
    counterLift: inner.bottom - base - counter.top - 2,
    sitX: inner.width * 0.05 + (ART_W.sit * k) / 2,
  };
}

export function useDog(run: Run | null, refs: DogRefs): DogView {
  const mode = modeOf(run);
  const [view, setView] = useState<DogView>({ pose: mode === "out" ? "run" : "sleep", carrying: false, paperKey: 0 });
  const rig = useRef<Rig>({ x: 0, lift: 0, scale: 1, facing: 1, show: mode === "out" ? 0 : 1, door: 0, paperX: 0, paper: 0 });
  const seq = useRef(0);
  const busy = useRef(false);
  const prevMode = useRef<Mode>(mode);
  const want = useRef<Mode>(mode);
  const homecoming = useRef(false);
  want.current = mode;

  const apply = () => {
    const R = rig.current, d = refs.dog.current, f = refs.flip.current, p = refs.panel.current, pp = refs.paper.current;
    if (d) { d.style.transform = `translate(${R.x}px, ${-R.lift}px) scale(${R.scale})`; d.style.opacity = String(R.show); }
    if (f) f.style.transform = `scaleX(${R.facing})`;
    if (p) p.style.transform = `rotateY(${-72 * R.door}deg)`;
    if (pp) { pp.style.left = `${R.paperX}px`; pp.style.opacity = String(R.paper); }
  };
  const poseRef = useRef<Pose>(view.pose);
  const pose = (p: Pose, extra: Partial<DogView> = {}) => { poseRef.current = p; setView((v) => ({ ...v, pose: p, ...extra })); };

  // Home spot for a mode, placed instantly (first paint, resize, reduced motion).
  const place = (m: Mode) => {
    const sc = refs.scene.current, dg = refs.dog.current;
    if (!sc || !dg) return;
    const M = measure(sc, dg), R = rig.current;
    if (m === "out") Object.assign(R, { x: M.goneX, lift: M.sill, scale: T.sillScale, show: 0, door: 0 });
    else if (m === "type") Object.assign(R, { x: M.counterX, lift: M.counterLift, scale: 1, show: 1, facing: 1 });
    else if (m === "sit") Object.assign(R, { x: M.sitX, lift: 0, scale: 1, show: 1, facing: 1 });
    else Object.assign(R, { x: M.table, lift: 0, scale: 1, show: 1, facing: 1 });
    pose(m === "out" ? "run" : m === "type" ? "type" : m === "sit" ? "sit" : "sleep", { carrying: false });
    apply();
  };

  useLayoutEffect(() => { place(mode); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    const sc = refs.scene.current;
    if (!sc || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (!busy.current) place(want.current); });
    ro.observe(sc);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const from = prevMode.current;
    prevMode.current = mode;
    if (from === mode || homecoming.current) return;

    const id = ++seq.current;
    const alive = () => id === seq.current;
    const R = rig.current;
    const sc = refs.scene.current!, dg = refs.dog.current!;
    const reduced = reducedMotion();

    // A one-shot clock: calls frame(t) every animation frame for `ms`, resolves false if superseded.
    const play = (ms: number, frame: (t: number) => void) => new Promise<boolean>((res) => {
      if (reduced || ms <= 0) { frame(ms); apply(); res(alive()); return; }
      const t0 = performance.now();
      const step = (now: number) => {
        if (!alive()) return res(false);
        const t = Math.min(ms, now - t0);
        frame(t); apply();
        if (t >= ms) res(true); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const wait = (ms: number) => play(reduced ? 0 : ms, () => {});
    const swing = (to: number) => { const a = R.door; return play(T.door, (t) => { R.door = a + (to - a) * EASE_IN_OUT(t / T.door); }); };
    const later = (ms: number, fn: () => unknown) => { void wait(ms).then((ok) => ok && fn()); };
    const face = (dir: number) => {
      if (Math.sign(R.facing) === dir && Math.abs(R.facing) === 1) return Promise.resolve(true);
      const a = R.facing;
      return play(T.turn, (t) => { R.facing = a + (dir - a) * EASE_IN_OUT(t / T.turn); });
    };

    // Trot along a path of x positions without stopping at the inner ones; depth (lift, scale)
    // eases toward its target inside [depthFrom, depthTo] of the walk.
    const walk = async (xs: number[], depth?: { lift: number; scale: number; from: number; to: number }) => {
      const keys: FlowKey[] = [[0, R.x]];
      let t = 0, last = R.x;
      for (const x of xs) { t += Math.max(T.minWalk / xs.length, (Math.abs(x - last) / T.speed) * 1000); keys.push([t, x]); last = x; }
      const total = t;
      if (Math.abs(last - R.x) < 2 && !depth) return { ok: true, total: 0 };
      if (!(await face(last >= R.x ? 1 : -1))) return { ok: false, total };
      pose("run");
      const l0 = R.lift, s0 = R.scale;
      const ok = await play(total, (tt) => {
        R.x = flow(tt, keys);
        const d = depth ? seg(tt, depth.from * total, depth.to * total, "inOut") : 0;
        const lift = depth ? l0 + (depth.lift - l0) * d : l0;
        R.lift = lift + T.bob * Math.abs(wave(tt, 380)) * (tt < total ? 1 : 0);
        R.scale = depth ? s0 + (depth.scale - s0) * d : s0;
      });
      if (ok) pose("stand");
      return { ok, total, keys };
    };

    const hop = (x: number, lift: number) => {
      const x0 = R.x, l0 = R.lift;
      return play(T.hop, (t) => {
        const p = t / T.hop;
        R.x = x0 + (x - x0) * EASE_IN_OUT(p);
        R.lift = l0 + (lift - l0) * EASE_OUT(p) + T.hopArc * Math.sin(Math.PI * p);
      });
    };

    const lieDown = async () => {
      const l0 = R.lift;
      pose("sleep");
      return play(T.lieDown, (t) => { R.lift = l0 - 1.5 * Math.sin(Math.PI * (t / T.lieDown)); });
    };

    const getUp = async () => {
      if (poseRef.current === "sleep" || poseRef.current === "sit") {
        pose("stretch");
        if (!(await wait(T.stretch))) return false;
        pose("stand");
        return wait(T.fade);
      }
      if (poseRef.current === "type") {           // hop down off the counter first
        const M = measure(sc, dg);
        pose("stand");
        if (!(await wait(T.fade))) return false;
        if (!(await walk([M.counterEdge - M.half - 4])).ok) return false;
        return hop(M.counterEdge + M.half + 12, 0);
      }
      return true;
    };

    const settle = async (m: Mode): Promise<void> => {
      const M = measure(sc, dg);
      if (m === "out") return goOut();
      if (m === "type") {
        if (!(await walk([M.counterEdge + M.half + 12])).ok) return;
        if (!(await face(-1))) return;
        if (!(await hop(M.counterEdge - M.half - 4, M.counterLift))) return;
        if (!(await walk([M.counterX])).ok) return;
        await face(1);
        pose("type");
        return;
      }
      if (m === "sit") {
        if (!(await walk([M.sitX])).ok) return;
        if (!(await face(1))) return;
        pose("sit");
        return;
      }
      if (!(await walk([M.table])).ok) return;
      if (!(await face(1))) return;
      if (!(await wait(T.hold / 2))) return;
      await lieDown();
    };

    const goOut = async () => {
      if (!(await getUp())) return;
      const M = measure(sc, dg);
      // Door starts to swing open just before the dog reaches the sill.
      const toSill = Math.max(T.minWalk / 2, (Math.abs(M.sillX - R.x) / T.speed) * 1000);
      later(Math.max(0, toSill - T.doorLead - T.door / 2), () => swing(1));
      const res = await walk([M.sillX, M.goneX], { lift: M.sill, scale: T.sillScale, from: 0.25, to: 0.62 });
      if (!res.ok) return;
      R.show = 0; apply();
      if (!(await wait(T.closeAfter))) return;
      await swing(0);
    };

    const comeHome = async (ok: boolean) => {
      homecoming.current = true;
      busy.current = true;
      try {
        const M = measure(sc, dg);
        Object.assign(R, { x: M.goneX, lift: M.sill, scale: T.sillScale, facing: -1, show: 0 });
        pose("run", { carrying: ok });
        apply();
        if (!(await swing(1))) return;
        R.show = 1;
        // Through the doorway and forward into the room, without stopping at the sill.
        const fromSill = (Math.abs(M.goneX - M.sillX) / T.speed) * 1000;
        later(fromSill + T.closeAfter, () => swing(0));
        const res = await walk([M.sillX, M.center], { lift: 0, scale: 1, from: 0.2, to: 0.7 });
        if (!res.ok) return;
        if (!(await wait(T.hold))) return;
        if (ok) {
          Object.assign(R, { paperX: R.x + R.facing * M.half * 0.9 - 20, paper: 1 });
          setView((v) => ({ ...v, carrying: false, paperKey: v.paperKey + 1 }));
          apply();
          if (!(await wait(T.admire))) return;
        } else {
          await lieDown();
          if (!(await wait(T.failedRest))) return;
          if (!(await getUp())) return;
        }
      } finally {
        homecoming.current = false;
      }
      if (!alive()) return;
      const next = want.current;
      prevMode.current = next;
      await settle(next);
      if (R.paper > 0 && alive()) {
        if (!(await wait(T.paperLinger))) return;
        await play(T.paperFade, (t) => { R.paper = 1 - seg(t, 0, T.paperFade, "inOut"); });
      }
    };

    void (async () => {
      busy.current = true;
      if (reduced) { if (from === "out") R.paper = 0; place(mode); busy.current = false; return; }
      if (from === "out") await comeHome(!(run?.command === "scrape" && run.status !== "done"));
      else { if (await getUp()) await settle(mode); }
      if (alive()) busy.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return view;
}
