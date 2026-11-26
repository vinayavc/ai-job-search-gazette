// The classifieds: two newspaper columns of ads, each circle-able with the red marker.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { Job } from "../../contract/types";
import { PawStamp, DachshundPeek } from "../art";
import { adWeight, balanceColumns, handLoopPath, seeded, stampText } from "./util";

/**
 * The red marker loop. It is a child of the ad (which is position: relative), measures the
 * ad's own box with a ResizeObserver and draws in that box's pixel coordinates, so it can
 * never drift onto a neighbouring ad, whatever the column layout does.
 */
export function MarkerCircle({ seed }: { seed: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const measure = () => {
      const w = host.offsetWidth + 12; // inset -6px each side
      const h = host.offsetHeight + 12;
      setBox((b) => (b && Math.abs(b.w - w) < 1 && Math.abs(b.h - h) < 1 ? b : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const rot = (seeded(seed + "rot")() - 0.5) * 1.6; // within +/-0.8deg
  return (
    <svg
      ref={ref}
      className="gz-circle"
      aria-hidden="true"
      width={box?.w ?? 0}
      height={box?.h ?? 0}
      viewBox={box ? `0 0 ${box.w} ${box.h}` : undefined}
      preserveAspectRatio="none"
      style={{ transform: `rotate(${rot.toFixed(2)}deg)` }}
    >
      {box && <path d={handLoopPath(box.w, box.h, seed)} pathLength={1} />}
    </svg>
  );
}

interface AdProps {
  job: Job;
  circled: boolean;
  inkIndex: number | null; // stagger index for fresh ads; null = no ink-in
  onToggle: () => void;
  onOpen: () => void;
  fresh?: boolean;               // came in with this morning's paper
  registerRef?: (el: HTMLButtonElement | null) => void;
}

export function Ad({ job, circled, inkIndex, onToggle, onOpen, fresh, registerRef }: AdProps) {
  const clickTimer = useRef<number | null>(null);
  const vetoed = job.vetoed;

  const handleClick = (e: MouseEvent) => {
    if (vetoed) { onOpen(); return; }
    if (e.detail === 0) { onToggle(); return; } // keyboard activation
    if (e.detail > 1) return;
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => { clickTimer.current = null; onToggle(); }, 230);
  };
  const handleDouble = () => {
    if (clickTimer.current) { window.clearTimeout(clickTimer.current); clickTimer.current = null; }
    onOpen();
  };
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "o" || e.key === "O") { e.preventDefault(); onOpen(); }
  };

  const meta = [job.company, job.location].filter(Boolean).join(", ");
  const label = vetoed
    ? `${job.title} at ${job.company}. Not for you. Press to read.`
    : `${job.title} at ${job.company}. ${circled ? "Circled" : "Not circled"}. Press Enter to ${circled ? "uncircle" : "circle"}, O to read.`;

  return (
    <div
      className={`gz-ad${vetoed ? " is-vetoed" : ""}${inkIndex !== null ? " ink-in" : ""}`}
      style={inkIndex !== null ? { animationDelay: `${Math.min(inkIndex, 14) * 90}ms` } : undefined}
    >
      <button
        type="button"
        ref={registerRef}
        className="gz-ad-body"
        aria-pressed={vetoed ? undefined : circled}
        aria-label={label}
        onClick={handleClick}
        onDoubleClick={handleDouble}
        onKeyDown={handleKey}
      >
        <span className="gz-ad-title">{fresh && <span className="gz-new">New</span>}{job.title}</span>
        {meta && <span className="gz-ad-meta">{meta}</span>}
        {job.strengths[0] && !vetoed && <span className="gz-ad-strength">{job.strengths[0]}</span>}
      </button>
      <div className="gz-ad-actions">
        <span className="gz-ad-stamps">
          {vetoed ? (
            <span className="gz-stamp gz-stamp-soft">NOT FOR YOU</span>
          ) : job.rankScore !== null ? (
            <span className="gz-stamp">FIT {job.rankScore}</span>
          ) : (
            // /rank never scores jobs already in the tracker, so those carry only their paw stamp.
            !job.application && <span className="gz-stamp gz-stamp-soft">WAITING FOR THE DESK</span>
          )}
          {job.flagged && !vetoed && <span className="gz-readclosely">read closely</span>}
          {job.application && (
            <span className="gz-paw" title={stampText(job.application)}>
              <PawStamp size={44} text={stampText(job.application)} />
            </span>
          )}
        </span>
        <button type="button" className="gz-linkbtn gz-ad-read" onClick={onOpen} aria-label={`Read the ad: ${job.title} at ${job.company}`}>
          Read
        </button>
      </div>
      {circled && !vetoed && <MarkerCircle seed={job.key} />}
    </div>
  );
}

interface ClassifiedsProps {
  fresh: Job[];
  rest: Job[];
  circled: Set<string>;
  inkIn: boolean;
  onToggle: (key: string) => void;
  onOpen: (key: string) => void;
  registerRef: (key: string, el: HTMLButtonElement | null) => void;
}

function Columns({ jobs, circled, inkStart, inkIn, onToggle, onOpen, registerRef }: {
  jobs: Job[]; circled: Set<string>; inkStart: number; inkIn: boolean;
  onToggle: (k: string) => void; onOpen: (k: string) => void;
  registerRef: (key: string, el: HTMLButtonElement | null) => void;
}) {
  const [left, right] = balanceColumns(jobs, adWeight);
  const render = (list: Job[], offset: number) =>
    list.map((j, i) => (
      <Ad
        key={j.key}
        job={j}
        circled={circled.has(j.key)}
        inkIndex={inkIn ? inkStart + offset + i : null}
        onToggle={() => onToggle(j.key)}
        onOpen={() => onOpen(j.key)}
        registerRef={(el) => registerRef(j.key, el)}
      />
    ));
  return (
    <div className="gz-cols">
      <div className="gz-col">{render(left, 0)}</div>
      <div className="gz-col">{render(right, left.length)}</div>
    </div>
  );
}

export function Classifieds({ fresh, rest, circled, inkIn, onToggle, onOpen, registerRef }: ClassifiedsProps) {
  if (fresh.length === 0 && rest.length === 0) {
    return (
      <section className="gz-classifieds" aria-labelledby="gz-cl-h">
        <h2 id="gz-cl-h" className="gz-section-head">Classifieds</h2>
        <div className="gz-empty">
          <DachshundPeek size={110} />
          <p>No ads yet. Send the dog for today's paper.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="gz-classifieds" aria-labelledby="gz-cl-h">
      <h2 id="gz-cl-h" className="gz-section-head">Classifieds</h2>
      <p className="gz-hint">Click an ad to circle it. Double-click, or press Read, to read it.</p>
      {fresh.length > 0 && (
        <>
          <h3 className="gz-subhead">Fresh this morning</h3>
          <Columns jobs={fresh} circled={circled} inkStart={0} inkIn={inkIn} onToggle={onToggle} onOpen={onOpen} registerRef={registerRef} />
        </>
      )}
      {rest.length > 0 && (
        <>
          <h3 className="gz-subhead">Still on the board</h3>
          <Columns jobs={rest} circled={circled} inkStart={0} inkIn={false} onToggle={onToggle} onOpen={onOpen} registerRef={registerRef} />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------
// One newspaper page at a time. Ads are measured at the real column width and packed into one or two
// columns that exactly fit the page, so a page never scrolls; you flip pages like a real paper.

interface PagesProps {
  jobs: Job[];                       // fresh ads first
  freshKeys: Set<string>;
  circled: Set<string>;
  inkIn: boolean;
  onToggle: (key: string) => void;
  onOpen: (key: string) => void;
  registerRef: (key: string, el: HTMLButtonElement | null) => void;
  tail?: { label: string; node: ReactNode };   // an extra last page (letters to the editor)
}

export function ClassifiedPages({ jobs, freshKeys, circled, inkIn, onToggle, onOpen, registerRef, tail }: PagesProps) {
  const area = useRef<HTMLDivElement>(null);
  const meas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pages, setPages] = useState<Job[][][]>([]);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const cols = size.w >= 620 ? 2 : 1;
  const colW = cols === 2 ? Math.floor((size.w - 1) / 2) : size.w;

  useLayoutEffect(() => {
    const el = area.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight })));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // Pack ads into pages using their measured heights (the hidden copy below renders them at column width).
  useLayoutEffect(() => {
    const m = meas.current; if (!m || !size.h) return;
    const hs = [...m.children].map((c) => { const st = getComputedStyle(c); return c.getBoundingClientRect().height + parseFloat(st.marginBottom || "0"); });
    const out: Job[][][] = []; let cur: Job[][] = [[]]; let used = 0;
    jobs.forEach((j, i) => {
      const h = hs[i] ?? 120;
      if (used + h > size.h && cur[cur.length - 1].length) {
        if (cur.length < cols) { cur.push([]); } else { out.push(cur); cur = [[]]; }
        used = 0;
      }
      cur[cur.length - 1].push(j); used += h;
    });
    if (cur[0].length) out.push(cur);
    setPages(out);
  }, [jobs, circled, size, cols]);

  const total = pages.length + (tail ? 1 : 0);
  useEffect(() => { if (total && page > total - 1) setPage(total - 1); }, [total, page]);
  const go = useCallback((d: 1 | -1) => setPage((p) => { const n = Math.min(Math.max(p + d, 0), Math.max(total - 1, 0)); if (n !== p) setDir(d); return n; }), [total]);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const swipe = useRef<number | null>(null);   // swipe left/right on a phone to turn the page
  const isTail = !!tail && page === pages.length;
  const sheet = pages[page];
  const renderAd = (j: Job, i: number) => (
    <Ad key={j.key} job={j} circled={circled.has(j.key)} fresh={freshKeys.has(j.key)}
      inkIndex={inkIn && page === 0 && freshKeys.has(j.key) ? i : null}
      onToggle={() => onToggle(j.key)} onOpen={() => onOpen(j.key)}
      registerRef={(el) => registerRef(j.key, el)} />
  );

  return (
    <div className="gz-pager-wrap">
      <div className="gz-pages-area" ref={area}
        onTouchStart={(e) => { swipe.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const x0 = swipe.current; swipe.current = null; if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
        <div className="gz-measure" ref={meas} aria-hidden="true" {...{ inert: "" }} style={{ width: colW }}>
          {size.h > 0 && jobs.map((j) => <Ad key={j.key} job={j} circled={circled.has(j.key)} fresh={freshKeys.has(j.key)} inkIndex={null} onToggle={() => {}} onOpen={() => {}} />)}
        </div>
        {jobs.length === 0 && !tail ? (
          <div className="gz-empty"><DachshundPeek size={110} /><p>No ads yet. Send the mail van for today's paper.</p></div>
        ) : (
          <div key={page} className={`gz-sheet ${dir > 0 ? "flip-next" : "flip-prev"}${isTail ? " is-tail" : ""}`}>
            {isTail ? tail!.node : sheet ? (
              <div className="gz-cols">
                {sheet.map((col, ci) => <div className="gz-col" key={ci}>{col.map((j, i) => renderAd(j, ci * 20 + i))}</div>)}
              </div>
            ) : null}
          </div>
        )}
      </div>
      {total > 1 && (
        <nav className="gz-pager" aria-label="Turn the page">
          <button type="button" className="gz-linkbtn" onClick={() => go(-1)} disabled={page === 0}>&lsaquo; Previous page</button>
          <span className="gz-pager-n">{isTail ? tail!.label : `Page ${page + 1} of ${total}`}</span>
          <button type="button" className="gz-linkbtn" onClick={() => go(1)} disabled={page >= total - 1}>
            {tail && page === pages.length - 1 ? `${tail.label} ›` : "Next page ›"}
          </button>
        </nav>
      )}
    </div>
  );
}
