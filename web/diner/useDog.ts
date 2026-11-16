// Dog choreography: turns the current run into a little sequence of poses and positions.
import { useEffect, useRef, useState } from "react";
import type { Run } from "../../contract/types";

export type Pose = "sleep" | "stand" | "run" | "sit" | "type" | "lie";
export type Mode = "idle" | "out" | "type" | "sit";

export interface Dog {
  pose: Pose;
  x: number;            // % from the left of the scene
  facing: 1 | -1;       // 1 = right
  carrying: boolean;
  hidden: boolean;
  ms: number;           // transition time for the move to x
  door: boolean;        // door open
  paper: boolean;       // dropped newspaper on the floor
}

// Spots across the diner (percent of scene width, measured at the dog's left edge).
export const SPOT = { table: 36, center: 58, door: 80, outside: 96, radio: 5, counter: 1.5 } as const;

const ACTIVE = new Set(["queued", "running", "waiting_input"]);
export function modeOf(run: Run | null): Mode {
  if (!run || !ACTIVE.has(run.status)) return "idle";
  if (run.command === "scrape") return "out";
  if (run.command === "apply") return "type";
  return "sit";
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const SPEED = 22; // % of width per second at a calm trot

const home: Record<Mode, Partial<Dog>> = {
  idle: { pose: "sleep", x: SPOT.table, hidden: false, carrying: false },
  out: { pose: "run", x: SPOT.outside, hidden: true, carrying: false },
  type: { pose: "type", x: SPOT.counter, hidden: false, carrying: false },
  sit: { pose: "sit", x: SPOT.radio, hidden: false, carrying: false },
};

export function useDog(run: Run | null): Dog {
  const mode = modeOf(run);
  const [dog, setDog] = useState<Dog>({ pose: "sleep", x: SPOT.table, facing: 1, carrying: false, hidden: false, ms: 0, door: false, paper: false, ...home[mode] });
  const cur = useRef(dog);
  cur.current = dog;
  const prevMode = useRef<Mode>(mode);
  const want = useRef<Mode>(mode);
  const locked = useRef(false);
  const seq = useRef(0);
  want.current = mode;

  useEffect(() => {
    const from = prevMode.current;
    prevMode.current = mode;
    if (from === mode) return;
    if (locked.current) return; // a homecoming is playing; it settles on want.current when done

    const id = ++seq.current;
    const alive = () => id === seq.current;
    const set = (p: Partial<Dog>) => { if (alive()) setDog((d) => ({ ...d, ...p })); };
    const wait = (ms: number) => new Promise<boolean>((r) => window.setTimeout(() => r(alive()), reduced() ? Math.min(ms, 50) : ms));
    const travel = async (x: number, extra: Partial<Dog> = {}) => {
      const dx = x - cur.current.x;
      if (Math.abs(dx) < 1 || reduced()) { set({ x, ms: 0, ...extra }); return wait(30); }
      const ms = Math.round((Math.abs(dx) / SPEED) * 1000);
      set({ pose: "run", facing: dx > 0 ? 1 : -1, x, ms, ...extra });
      return wait(ms);
    };
    const settle = async (m: Mode) => {
      const target = home[m];
      if (m === "out") return goOut();
      if (cur.current.hidden) set({ hidden: false });
      if (!(await travel(target.x!))) return;
      set({ ...target, ms: 0, facing: 1 });
    };
    const goOut = async () => {
      set({ pose: "stand", paper: false, ms: 0 });
      if (!(await wait(500))) return;
      if (!(await travel(SPOT.door, { facing: 1 }))) return;
      set({ door: true });
      if (!(await travel(SPOT.outside))) return;
      set({ hidden: true, ms: 0 });
      if (!(await wait(450))) return;
      set({ door: false });
    };
    const comeHome = async (ok: boolean) => {
      locked.current = true;
      try {
        set({ hidden: true, x: SPOT.outside, ms: 0, door: true, facing: -1, carrying: ok, pose: "run" });
        if (!(await wait(450))) return;
        set({ hidden: false });
        if (!(await travel(SPOT.door, { carrying: ok }))) return;
        if (!(await travel(SPOT.center, { carrying: ok }))) return;
        set({ door: false, pose: "stand" });
        if (!(await wait(350))) return;
        if (!ok) { set({ pose: "lie", facing: 1 }); if (!(await wait(3500))) return; }
        else {
          set({ carrying: false, paper: true });
          if (!(await wait(3000))) return;
        }
      } finally { locked.current = false; }
      if (!alive()) return;
      const next = want.current;
      prevMode.current = next;
      if (next === "idle" && !ok) return; // stays lying where it stopped
      await settle(next);
      if (alive()) window.setTimeout(() => alive() && set({ paper: false }), 1200);
    };

    if (from === "out") {
      const ok = !(run?.command === "scrape" && run.status !== "done");
      void comeHome(ok);
    } else {
      void settle(mode);
    }
  }, [mode, run]);

  return dog;
}
