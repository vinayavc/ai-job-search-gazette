// The Sausage Gazette front page.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RunView } from "../App";
import type { Edition, UiState, Command } from "../../contract/types";
import { DachshundMasthead, DachshundStretch, DachshundPeek } from "../art";
import { Classifieds } from "./Classifieds";
import { AdDetail } from "./AdDetail";
import { Letters } from "./Letters";
import { isActive, printableJobs, todayLine } from "./util";
import "./paper.css";

export interface NewspaperProps {
  edition: Edition | null; state: UiState | null; view: RunView;
  onStart: (c: Command, args?: string) => void; onCancel: () => void;
  onPatchState: (p: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => void; onMarkSent: (jobKey: string) => void;
}

const PIPELINE = [
  { status: "drafted", label: "drafted" },
  { status: "applied", label: "applied" },
  { status: "interview", label: "interview" },
  { status: "offer", label: "offer" },
];

export function Newspaper({ edition, state, view, onStart, onPatchState, onMarkSent }: NewspaperProps) {
  const run = view.run;
  const active = isActive(run);
  const folded = active && run?.command === "scrape";

  // Unfold animation only when we go from folded -> unfolded.
  const wasFolded = useRef(folded);
  const [unfolding, setUnfolding] = useState(false);
  useEffect(() => {
    if (wasFolded.current && !folded) { setUnfolding(true); setInkIn(true); }
    wasFolded.current = folded;
  }, [folded]);

  // Fresh ads ink in on first print and after each unfold; afterwards they just sit there.
  const [inkIn, setInkIn] = useState(true);
  useEffect(() => {
    if (!inkIn || !edition) return;
    const t = window.setTimeout(() => setInkIn(false), 3200);
    return () => window.clearTimeout(t);
  }, [inkIn, edition]);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const adRefs = useRef(new Map<string, HTMLButtonElement>());
  const returnFocus = useRef<string | null>(null);

  const jobs = edition?.jobs ?? [];
  const printed = useMemo(() => printableJobs(jobs), [jobs]);
  const fresh = printed.filter((j) => j.isFresh);
  const rest = printed.filter((j) => !j.isFresh);
  const circled = useMemo(() => new Set(state?.circled ?? []), [state?.circled]);
  const circledJobs = jobs.filter((j) => circled.has(j.key));
  // Ads /rank will still score: unscored, not vetoed, and not already in the tracker.
  const waiting = printed.filter((j) => j.rankScore === null && !j.vetoed && !j.application).length;
  const openJob = openKey ? jobs.find((j) => j.key === openKey) ?? null : null;

  const toggle = useCallback((key: string) => {
    onPatchState((s) => ({
      circled: s.circled.includes(key) ? s.circled.filter((k) => k !== key) : [...s.circled, key],
    }));
  }, [onPatchState]);

  const open = useCallback((key: string) => { returnFocus.current = key; setOpenKey(key); }, []);
  const back = useCallback(() => setOpenKey(null), []);
  useEffect(() => {
    if (openKey === null && returnFocus.current) {
      const el = adRefs.current.get(returnFocus.current);
      returnFocus.current = null;
      if (el) { el.focus(); el.scrollIntoView({ block: "center" }); }
    }
  }, [openKey]);
  const registerRef = useCallback((key: string, el: HTMLButtonElement | null) => {
    if (el) adRefs.current.set(key, el); else adRefs.current.delete(key);
  }, []);

  const apps = edition?.applications ?? [];
  const pipeline = PIPELINE.map((p) => ({ ...p, n: apps.filter((a) => a.status === p.status).length }));

  const editionLine = !edition
    ? "The presses are warming up."
    : fresh.length > 0
      ? `${countWords(fresh.length)} came in with this morning's paper. Take your time.`
      : printed.length > 0
        ? "Nothing new this morning; the board still has a few worth a look."
        : "A quiet edition. Pour another coffee.";

  return (
    <div className="gz-paper">
      <div className="gz-toprule">
        <span>Vol. I, No. {edition?.editionNumber ?? 1}</span>
        <span>{todayLine()}</span>
        <span>Price: one belly rub</span>
      </div>

      <header className="gz-masthead">
        <DachshundMasthead size={150} className="gz-masthead-dog" />
        <h1 className="gz-title">The Sausage Gazette</h1>
        <p className="gz-tagline">ALL THE JOBS THAT ARE FIT TO SNIFF</p>
      </header>
      <div className="gz-doublerule" />

      {active && view.ticker.length > 0 && (
        <div className="gz-wire" role="status" aria-live="polite">
          <span className="gz-wire-label">On the wire:</span>{" "}
          <span key={view.ticker.length} className="gz-wire-line">{view.ticker[view.ticker.length - 1]}</span>
        </div>
      )}

      {!edition ? (
        <div className="gz-folded"><p>The presses are warming up&hellip;</p></div>
      ) : !edition.profile.hasProfile ? (
        <section className="gz-subscribe" aria-labelledby="gz-sub-h">
          <DachshundPeek size={120} />
          <h2 id="gz-sub-h">Subscribe to the Gazette</h2>
          <p>Tell the desk a little about yourself, and every morning's paper will carry the ads that suit you.</p>
          <button type="button" className="gz-btn" disabled={active} onClick={() => onStart("setup")}>Start my subscription</button>
        </section>
      ) : folded ? (
        <div className="gz-folded" role="status">
          <div className="gz-folded-sheet" aria-hidden="true" />
          <p>The paper's out being fetched&hellip;</p>
          <p className="gz-quiet">Sip your coffee. It'll be on the table shortly.</p>
        </div>
      ) : (
        <div className={`gz-body${unfolding ? " is-unfolding" : ""}`} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setUnfolding(false); }}>
          {openJob ? (
            <div className="gz-pageturn" key={openJob.key}>
              <AdDetail job={openJob} run={run} onBack={back} onStart={onStart} onMarkSent={onMarkSent} />
            </div>
          ) : (
            <div className="gz-front">
              <aside className="gz-sidebar" aria-label="Today's edition">
                <h2 className="gz-headline">{edition.profile.name ? `Good morning, ${edition.profile.name.split(" ")[0]}` : "Good morning"}</h2>
                <p className="gz-lede">{editionLine}</p>

                <h3 className="gz-side-head">Your circles</h3>
                {circledJobs.length === 0 ? (
                  <p className="gz-quiet">Circle an ad with the red marker and it'll wait for you here.</p>
                ) : (
                  <ul className="gz-circles-list">
                    {circledJobs.map((j) => (
                      <li key={j.key}>
                        <button type="button" className="gz-linkbtn" onClick={() => open(j.key)}>
                          {j.title}
                        </button>
                        <span className="gz-quiet"> &middot; {j.company}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <h3 className="gz-side-head">The pipeline</h3>
                <ol className="gz-pipeline" aria-label="Applications by stage">
                  {pipeline.map((p, i) => (
                    <li key={p.status}>
                      <span className="gz-pipe-n">{p.n}</span> {p.label}
                      {i < pipeline.length - 1 && <span className="gz-pipe-arrow" aria-hidden="true"> &rarr;</span>}
                    </li>
                  ))}
                </ol>

                <label className="gz-toggle">
                  <input
                    type="checkbox"
                    checked={state?.autoRank ?? true}
                    disabled={!state}
                    onChange={(e) => onPatchState({ autoRank: e.target.checked })}
                  />
                  <span>Auto-rank after fetching</span>
                </label>

                {waiting > 0 && (
                  <p className="gz-desk-note">
                    {waiting === 1 ? "One ad is" : `${waiting} ads are`} waiting for the ranking desk, which reads ten at a time.{" "}
                    {!active && (
                      <button type="button" className="gz-linkbtn" onClick={() => onStart("rank")}>
                        Send the next batch
                      </button>
                    )}
                  </p>
                )}

                <DachshundStretch size={140} className="gz-vignette" />
              </aside>

              <div className="gz-main">
                <Classifieds
                  fresh={fresh}
                  rest={rest}
                  circled={circled}
                  inkIn={inkIn}
                  onToggle={toggle}
                  onOpen={open}
                  registerRef={registerRef}
                />
                <div className="gz-gutter-dog" aria-hidden="true"><DachshundPeek size={90} /></div>
                <Letters applications={apps} busy={active} onStart={onStart} />
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="gz-foot">
        <span>Printed slowly, read slowly.</span>
      </footer>
    </div>
  );
}

// Spelled-out counts keep the lede's drop cap from splitting a number ("1 9").
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];
function countWords(n: number): string {
  if (n === 1) return "One new ad";
  return n < WORDS.length ? `${WORDS[n]} new ads` : "More than twenty new ads";
}
