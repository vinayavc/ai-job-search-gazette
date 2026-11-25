// The Tiny Diorama header. One three.js scene (scene.js, built from diorama-wip) whose story time is driven by
// what the app is doing: each stage plays its own beats and then holds there while the tile keeps living.
//
//   /scrape running  -> 0 .. 3.4    the press, the drive; holds with the van at your house
//   /scrape done     -> .. 5.25     the paper lands on the mat, the dog wakes (the newspaper below unfolds)
//   /rank running    -> 5.25 .. 6.7 ads pop up and get their fit stamps; done -> .. 7.55 they settle away
//   /apply running   -> 7.6 .. 9.0  the dog types, CV and cover letter pop up; done -> .. 11.25 posted, flag up
//   "Posted it?" yes -> 11.2 .. 17  you hand the letter to the mailman; dusk delivery at the office
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { RunView } from "../App";
import type { UiState } from "../../contract/types";
import { Radio } from "../diner/Radio";
import "../diner/radio.css";
import "./diorama.css";

type Beat = { t0: number; t1: number; tag: string; text: string };
// A stretch of story to play: continue if the story is already inside `keep`, otherwise cut to `cut` first.
type Seg = { cut: number; keep: [number, number]; to: number };
interface Stage { seek: (t: number, samples?: number) => void }

declare global {
  interface Window {
    THREE?: unknown; K?: { run: (c: HTMLCanvasElement, style: unknown, o: object) => Promise<Stage> };
    STYLES?: { beats: Beat[] }[];
    __gazetteApp?: { ambient: number | null; ring: boolean; flag: boolean | null; captions: boolean; zoom?: number; lift?: number; lite?: boolean };
  }
}

export interface DioramaHeaderProps {
  view: RunView;
  drafts: number;               // tailored applications you haven't sent yet -> the letterbox flag stays up
  sentAt: number | null;        // bumps when you answer "Posted it?" with yes
  onFetch: () => void;
  radio: UiState["radio"];
  onRadioChange: (r: UiState["radio"]) => void;
}

const IDLE_T = 11.25;   // the dog asleep, the flag showing your unsent drafts, before the door opens (11.3)
const ACTIVE = new Set(["queued", "running", "waiting_input"]);

export function DioramaHeader({ view, drafts, sentAt, onFetch, radio, onRadioChange }: DioramaHeaderProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const clock = useRef({ st: IDLE_T, goal: IDLE_T, cutAt: 0, queue: [] as Seg[] });
  const beats = useRef<Beat[]>([]);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const busyRef = useRef(false);   // keep the stage caption up while an errand is still running
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [caption, setCaption] = useState<Beat | null>(null);
  const [cut, setCut] = useState(0);

  // Load three.js, the stage kit and the scene once, then run one render loop.
  useEffect(() => {
    let alive = true, raf = 0, lastHold = 0, prev = performance.now();
    window.__gazetteApp = { ambient: 0, ring: false, flag: null, captions: false, zoom: 0.66, lift: 0.35, lite: true };   // a wide strip: closer, signs in view
    (async () => {
      try {
        window.THREE = THREE;
        await import("./stage.js");
        await import("./scene.js");
        const style = window.STYLES![window.STYLES!.length - 1];
        beats.current = style.beats;
        const cv = canvas.current!, W = 1440, H = Math.round(Math.min(720, Math.max(300, W * (cv.clientHeight || 480) / (cv.clientWidth || 1440))));
        cv.width = W; cv.height = H;
        const S = await window.K!.run(cv, style, { samples: 1, width: W, height: H });
        if (!alive) return;
        stage.current = S; setReady(true);
        (window as unknown as { __dioStage: Stage }).__dioStage = S;   // for debugging in the console
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const frame = (now: number) => {
          if (!alive) return;
          raf = requestAnimationFrame(frame);
          if (document.hidden) { prev = now; return; }
          const dt = Math.min(0.25, (now - prev) / 1000); prev = now;   // keeps story time close to real time if frames drop
          const c = clock.current, app = window.__gazetteApp!;
          app.ambient = now / 1000;
          if (c.st >= c.goal && c.queue.length) start(c.queue.shift()!);   // beats play in order, never skipped
          if (c.st < c.goal) {
            c.st = reduced ? c.goal : Math.min(c.goal, c.st + dt);
            app.flag = null;                                     // the story animates the flag itself
            S.seek(c.st, 1);                                       // moving: one fast render per frame
            const b = beats.current.find((x) => c.st >= x.t0 && c.st < x.t1) ?? null;
            setCaption((old) => (old?.text === b?.text ? old : b));
          } else {                                               // resting: same sharp single pass, every frame, so nothing stalls
            lastHold = now;
            app.flag = draftsRef.current > 0;
            S.seek(c.st, 1);
            if (!busyRef.current && now - c.cutAt > 2600) setCaption(null);
          }
        };
        raf = requestAnimationFrame(frame);
      } catch (e) {
        console.error(e);
        setFailed(String((e as Error).message ?? e));
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);

  // Start a segment now: continue if the story is already inside its `keep` window, else cut (with a soft fade).
  const start = (seg: Seg) => {
    const c = clock.current;
    if (c.st < seg.keep[0] - 0.01 || c.st > seg.keep[1] + 0.01) { c.st = seg.cut; setCut((n) => n + 1); }
    c.goal = Math.max(seg.to, c.st); c.cutAt = performance.now();
  };
  // Queue a segment behind whatever is still playing; a repeat of the last request is ignored.
  const play = (cut: number, keep: [number, number], to: number) => {
    const c = clock.current, last = c.queue[c.queue.length - 1];
    if ((last ? last.to : c.goal) === to) return;
    const seg = { cut, keep, to };
    if (c.st < c.goal || c.queue.length) c.queue.push(seg); else start(seg);
  };

  const run = view.run;
  const active = !!run && ACTIVE.has(run.status);
  busyRef.current = active;
  useEffect(() => {
    if (!run) return;
    if (run.command === "scrape") {
      if (active) play(0, [0, 3.4], 3.4);                      // a status change mid-run (a question) won't restart it
      else if (run.status === "done") play(0, [0, 5.25], 5.25);
    } else if (run.command === "rank") {
      if (active) play(5.25, [5.25, 6.7], 6.7);
      else if (run.status === "done") play(6.7, [5.25, 7.55], 7.55);
    } else if (run.command === "apply") {
      if (active) play(7.6, [7.6, 9.0], 9.0);
      else if (run.status === "done") play(9.0, [7.6, IDLE_T], IDLE_T);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status]);

  useEffect(() => { if (sentAt) play(11.2, [11.2, 17], 17); }, [sentAt]);

  const busy = active;
  return (
    <section className="dio" aria-label="The Sausage Gazette's little town">
      <canvas ref={canvas} width={1440} height={480} className={`dio-canvas ${ready ? "is-ready" : ""}`} />
      <div className="dio-cut" key={cut} aria-hidden="true" />
      {!ready && !failed && <div className="dio-loading">Setting up the little town…</div>}
      {failed && <div className="dio-loading">The town couldn't load ({failed}). The newspaper below still works.</div>}
      <button type="button" className="fetch-tag" onClick={onFetch} disabled={busy}
        title={busy ? "One errand at a time" : "Send the mail van for today's edition"}>
        <span className="tag-hole" aria-hidden="true" />
        <small>Menu</small>
        {busy && run?.command === "scrape" ? "Fetching the paper…" : "Fetch today's edition"}
      </button>
      <div className="dio-radio"><Radio radio={radio} onChange={onRadioChange} /></div>
      {caption && (
        <div className="dio-caption" role="status" aria-live="polite">
          <b>{caption.tag}</b>
          <span>{caption.text}</span>
        </div>
      )}
      {drafts > 0 && !caption && (
        <div className="dio-note">{drafts === 1 ? "One letter is" : `${drafts} letters are`} waiting in the letterbox for you to apply.</div>
      )}
    </section>
  );
}
