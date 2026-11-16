// The diner banner above the paper: wall, window, door, counter, radio and the dachshund.
import { useEffect, useState } from "react";
import type { RunView } from "../App";
import type { Command, Run, RunStatus, UiState } from "../../contract/types";
import { DachshundFetch, DachshundSit, DachshundSleep, DachshundTypewriter } from "../art";
import { modeOf, useDog, type Dog } from "./useDog";
import { Radio } from "./Radio";
import "./diner.css";

export interface DinerSceneProps { view: RunView; onFetch: () => void; radio: UiState["radio"]; onRadioChange: (r: UiState["radio"]) => void }

const LABEL: Record<string, string> = {
  setup: "Taking your order", scrape: "Out fetching", rank: "Sorting the stack", apply: "Typing it up",
  outcome: "Filing the outcome", "gmail-sync": "Checking the mail", interview: "Interview prep", upskill: "Study hall",
};

function chalk(view: RunView): { head: string; line: string } {
  const run = view.run;
  const last = view.ticker[view.ticker.length - 1];
  if (!run || modeOf(run) === "idle") {
    if (run?.command === "scrape" && run.status === "done") return { head: "Fresh today", line: "Edition delivered" };
    if (run && (run.status === "failed" || run.status === "cancelled")) return { head: "Back soon", line: "No paper this time" };
    return { head: "Today's special", line: "Fresh leads, hot coffee" };
  }
  const head = LABEL[run.command] ?? "In the kitchen";
  if (run.status === "waiting_input") return { head, line: "Waiting on your answer" };
  return { head, line: last ?? (run.status === "queued" ? "Grabbing the leash" : "Working on it") };
}

function DogSprite({ dog }: { dog: Dog }) {
  const art =
    dog.pose === "sleep" || dog.pose === "lie" ? <DachshundSleep size={100} className="dog-art" /> :
    dog.pose === "sit" ? <DachshundSit size={74} className="dog-art" /> :
    dog.pose === "type" ? <DachshundTypewriter size={104} className="dog-art" /> :
    <DachshundFetch size={120} className="dog-art" running={dog.pose === "run"} carrying={dog.carrying} />;
  return (
    <div
      className={`dog pose-${dog.pose} ${dog.hidden ? "is-hidden" : ""}`}
      style={{ left: `${dog.x}%`, transitionDuration: `${dog.ms}ms, 300ms` }}
      aria-hidden="true"
    >
      <div className="dog-flip" style={{ transform: `scaleX(${dog.facing})` }}>{art}</div>
      {dog.pose === "sleep" && <span className="zzz"><i>z</i><i>z</i><i>z</i></span>}
    </div>
  );
}

function Street() {
  return (
    <svg className="street" viewBox="0 0 200 80" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <rect width="200" height="80" fill="#d9ece6" />
      <g fill="#a9cbc2">
        <rect x="-4" y="30" width="34" height="50" /><rect x="34" y="16" width="26" height="64" />
        <rect x="64" y="38" width="40" height="42" /><rect x="108" y="22" width="30" height="58" />
        <rect x="142" y="34" width="26" height="46" /><rect x="172" y="12" width="32" height="68" />
        <path d="M64 38l20-10l20 10z" />
      </g>
      <g fill="#e9e3d3" opacity="0.8">
        <rect x="40" y="22" width="5" height="6" /><rect x="50" y="22" width="5" height="6" /><rect x="40" y="34" width="5" height="6" />
        <rect x="114" y="28" width="5" height="6" /><rect x="126" y="40" width="5" height="6" /><rect x="178" y="20" width="5" height="6" />
        <rect x="190" y="32" width="5" height="6" /><rect x="74" y="48" width="6" height="7" /><rect x="88" y="48" width="6" height="7" />
      </g>
      <rect y="70" width="200" height="10" fill="#8fb3aa" />
      <g className="street-car">
        <rect x="0" y="62" width="22" height="7" rx="3" fill="#c0392b" />
        <path d="M5 62l3-5h8l3 5z" fill="#c0392b" />
        <circle cx="6" cy="70" r="2.2" fill="#2a2620" /><circle cx="17" cy="70" r="2.2" fill="#2a2620" />
      </g>
      <path className="street-bird" d="M0 0q3-3 6 0q3-3 6 0" fill="none" stroke="#2a2620" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Mug() {
  return (
    <div className="mug" aria-hidden="true">
      <span className="steam"><i /><i /><i /></span>
      <svg viewBox="0 0 30 26" width="30">
        <path d="M22 9h3a4 4 0 0 1 0 9h-3" fill="none" stroke="#2a2620" strokeWidth="2" />
        <path d="M3 4h19v14a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z" fill="#f3ead6" stroke="#2a2620" strokeWidth="2" strokeLinejoin="round" />
        <path d="M3 10h19" stroke="#c0392b" strokeWidth="3" />
      </svg>
    </div>
  );
}

// Preview helper for visual checks: ?diner=out | done | failed | apply | rank
function useDemo(view: RunView): RunView {
  const demo = typeof location !== "undefined" ? new URLSearchParams(location.search).get("diner") : null;
  const [step, setStep] = useState<{ command: Command; status: RunStatus } | null>(null);
  useEffect(() => {
    if (!demo) return;
    const command: Command = demo === "apply" ? "apply" : demo === "rank" ? "rank" : "scrape";
    setStep({ command, status: "running" });
    if (demo !== "done" && demo !== "failed") return;
    const t = window.setTimeout(() => setStep({ command, status: demo === "done" ? "done" : "failed" }), 6000);
    return () => window.clearTimeout(t);
  }, [demo]);
  if (!demo || !step) return view;
  const run: Run = { id: "demo", command: step.command, args: "", status: step.status, startedAt: null, endedAt: null, summary: null, error: null };
  return { ...view, run, ticker: ["Checking LinkedIn for new postings"] };
}

export function DinerScene(props: DinerSceneProps) {
  const { onFetch, radio, onRadioChange } = props;
  const view = useDemo(props.view);
  const dog = useDog(view.run);
  const busy = modeOf(view.run) !== "idle";
  const board = chalk(view);
  const fetching = modeOf(view.run) === "out";

  return (
    <section className={`diner ${dog.pose === "type" ? "is-typing" : ""}`} aria-label="The diner">
      <div className="diner-trim" />
      <div className="diner-window" aria-hidden="true">
        <Street />
        <div className="open-sign"><b>OPEN</b><span>COFFEE 5¢</span></div>
      </div>

      <div className={`diner-door ${dog.door ? "is-open" : ""}`} aria-hidden="true">
        <div className="door-outside" />
        <div className="door-panel"><span className="door-port" /><span className="door-knob" /></div>
      </div>

      <div className="chalkboard" role="status" aria-live="polite">
        <b>{board.head}</b>
        <span>{board.line}</span>
      </div>

      <button type="button" className="fetch-tag" onClick={onFetch} disabled={busy}
        title={busy ? "The dog is busy - one errand at a time" : "Send the dog out for today's edition"}>
        <span className="tag-hole" aria-hidden="true" />
        <small>Menu</small>
        {fetching ? "Fetching the paper…" : "Fetch today's edition"}
      </button>

      <div className="counter" aria-hidden="true">
        <div className="counter-top" />
        <div className="counter-front" />
      </div>
      <Mug />
      <Radio radio={radio} onChange={onRadioChange} />

      <div className="floor" aria-hidden="true" />
      <div className="rug" aria-hidden="true" />
      <div className="table" aria-hidden="true"><span className="table-top" /><span className="table-leg l" /><span className="table-leg r" /></div>

      {dog.paper && (
        <svg className="dropped-paper" viewBox="0 0 44 16" width="40" aria-hidden="true">
          <rect x="2" y="3" width="38" height="11" rx="5.5" fill="#f3ead6" stroke="#2a2620" strokeWidth="2" />
          <ellipse cx="36" cy="8.5" rx="2.5" ry="5.5" fill="#f3ead6" stroke="#2a2620" strokeWidth="2" />
          <path d="M18 3v11M21 3v11" stroke="#2a2620" strokeWidth="1.4" />
        </svg>
      )}
      <DogSprite dog={dog} />
      <span className="sr-only">
        {fetching ? "The dachshund is out fetching today's edition." : dog.pose === "sleep" ? "The dachshund is asleep under the table." : ""}
      </span>
    </section>
  );
}
