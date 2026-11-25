// The Sausage Gazette front page: one screen, no scrolling. The sidebar (your circles, the pipeline) stays put
// on the left; the classifieds are pages you flip; reading an ad turns to its own page in the same spot.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RunView } from "../App";
import type { Edition, Job, UiState, Command } from "../../contract/types";
import { DachshundMasthead, DachshundPeek } from "../art";
import { ClassifiedPages } from "./Classifieds";
import { AdDetail } from "./AdDetail";
import { Letters } from "./Letters";
import { useDogName } from "./dogName";
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
  const dog = useDogName();
  const run = view.run;
  const active = isActive(run);
  const folded = active && run?.command === "scrape";

  const wasFolded = useRef(folded);
  const [unfolding, setUnfolding] = useState(false);
  const [inkIn, setInkIn] = useState(true);
  useEffect(() => {
    if (wasFolded.current && !folded) { setUnfolding(true); setInkIn(true); }
    wasFolded.current = folded;
  }, [folded]);
  useEffect(() => {
    if (!inkIn || !edition) return;
    const t = window.setTimeout(() => setInkIn(false), 3200);
    return () => window.clearTimeout(t);
  }, [inkIn, edition]);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const adRefs = useRef(new Map<string, HTMLButtonElement>());
  const registerRef = useCallback((key: string, el: HTMLButtonElement | null) => {
    if (el) adRefs.current.set(key, el); else adRefs.current.delete(key);
  }, []);

  const jobs = edition?.jobs ?? [];
  const printed = useMemo(() => printableJobs(jobs), [jobs]);
  const ordered = useMemo(() => [...printed.filter((j) => j.isFresh), ...printed.filter((j) => !j.isFresh)], [printed]);
  const freshKeys = useMemo(() => new Set(printed.filter((j) => j.isFresh).map((j) => j.key)), [printed]);
  const circled = useMemo(() => new Set(state?.circled ?? []), [state?.circled]);
  const circledJobs = jobs.filter((j) => circled.has(j.key));
  const waiting = printed.filter((j) => j.rankScore === null && !j.vetoed && !j.application).length;
  const openJob = openKey ? jobs.find((j) => j.key === openKey) ?? null : null;
  const freshCount = freshKeys.size;

  const toggle = useCallback((key: string) => {
    onPatchState((s) => ({ circled: s.circled.includes(key) ? s.circled.filter((k) => k !== key) : [...s.circled, key] }));
  }, [onPatchState]);
  const open = useCallback((key: string) => setOpenKey(key), []);
  const tailor = useCallback((j: Job) => { setOpenKey(j.key); onStart("apply", j.url); }, [onStart]);

  const apps = edition?.applications ?? [];
  const pipeline = PIPELINE.map((p) => ({ ...p, n: apps.filter((a) => a.status === p.status).length }));
  const editionLine = !edition
    ? "The presses are warming up."
    : freshCount > 0
      ? `${countWords(freshCount)} came in with this morning's paper. Take your time.`
      : printed.length > 0 ? "Nothing new this morning; the board still has a few worth a look." : "A quiet edition. Pour another coffee.";

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const saveName = () => { const n = (nameDraft ?? "").trim(); if (n && n !== dog) onPatchState({ dogName: n.slice(0, 24) }); setNameDraft(null); };

  return (
    <div className="gz-paper">
      <div className="gz-toprule">
        <span className="gz-hide-narrow">Vol. I, No. {edition?.editionNumber ?? 1}</span>
        <span>{todayLine()}</span>
        <span className="gz-hide-narrow">Price: one belly rub</span>
      </div>
      <header className="gz-masthead">
        <DachshundMasthead size={84} className="gz-masthead-dog" />
        <div>
          <h1 className="gz-title">The Sausage Gazette</h1>
          <p className="gz-tagline">ALL THE JOBS THAT ARE FIT TO SNIFF</p>
        </div>
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
      ) : (
        <div className="gz-front">
          <aside className="gz-sidebar" aria-label="Your desk">
            <h2 className="gz-headline gz-hide-narrow">{edition.profile.name ? `Good morning, ${edition.profile.name.split(" ")[0]}` : "Good morning"}</h2>
            <p className="gz-lede gz-hide-narrow">{editionLine}</p>

            <h3 className="gz-side-head">Your circles{circledJobs.length ? ` (${circledJobs.length})` : ""}</h3>
            {circledJobs.length === 0 ? (
              <p className="gz-quiet">Circle an ad with the red marker and it'll wait for you here.</p>
            ) : (
              <ul className="gz-circles-list">
                {circledJobs.map((j) => (
                  <li key={j.key}>
                    <button type="button" className="gz-linkbtn gz-circle-title" onClick={() => open(j.key)}>{j.title}</button>
                    <span className="gz-quiet gz-circle-co">{j.company}</span>
                    <span className="gz-circle-acts">
                      <button type="button" className="gz-btn gz-btn-small" onClick={() => tailor(j)} disabled={active}>Tailor</button>
                      <button type="button" className="gz-linkbtn gz-small" onClick={() => toggle(j.key)}>Uncircle</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="gz-hide-narrow">
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
                <input type="checkbox" checked={state?.autoRank ?? true} disabled={!state} onChange={(e) => onPatchState({ autoRank: e.target.checked })} />
                <span>Auto-rank after fetching</span>
              </label>
              {waiting > 0 && (
                <p className="gz-desk-note">
                  {waiting === 1 ? "One ad is" : `${waiting} ads are`} waiting for the ranking desk, which reads ten at a time.{" "}
                  {!active && <button type="button" className="gz-linkbtn" onClick={() => onStart("rank")}>Send the next batch</button>}
                </p>
              )}
              <h3 className="gz-side-head">Your pup</h3>
              <label className="gz-pupname">
                <span className="gz-quiet">Name</span>
                <input id="gz-pup-name" value={nameDraft ?? dog} maxLength={24}
                  onChange={(e) => setNameDraft(e.target.value)} onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setNameDraft(null); }} />
              </label>
            </div>
          </aside>

          <div className="gz-main">
            {folded ? (
              <div className="gz-folded" role="status">
                <div className="gz-folded-sheet" aria-hidden="true" />
                <p>The paper's out being fetched&hellip;</p>
                <p className="gz-quiet">Sip your coffee. {dog} will bring it to the mat.</p>
              </div>
            ) : openJob ? (
              <div className="gz-detail-scroll gz-pageturn" key={openJob.key}>
                <AdDetail job={openJob} run={run} onBack={() => setOpenKey(null)} onStart={onStart} onMarkSent={onMarkSent} />
              </div>
            ) : (
              <div className={`gz-body${unfolding ? " is-unfolding" : ""}`} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setUnfolding(false); }}>
                <h2 className="gz-section-head">Classifieds</h2>
                <p className="gz-hint">Click an ad to circle it. Circled ads get a Tailor button.</p>
                <ClassifiedPages
                  jobs={ordered} freshKeys={freshKeys} circled={circled} inkIn={inkIn}
                  onToggle={toggle} onOpen={open} onTailor={tailor} registerRef={registerRef}
                  tail={apps.some((a) => !a.isFinal) ? { label: "Letters to the editor", node: <div className="gz-tailpage"><Letters applications={apps} busy={active} onStart={onStart} /></div> } : undefined}
                />
              </div>
            )}
          </div>
        </div>
      )}
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
