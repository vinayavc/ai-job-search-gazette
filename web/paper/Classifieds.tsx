// The classifieds: two newspaper columns of ads, each circle-able with the red marker.
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
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
  registerRef?: (el: HTMLButtonElement | null) => void;
}

export function Ad({ job, circled, inkIndex, onToggle, onOpen, registerRef }: AdProps) {
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
        <span className="gz-ad-title">{job.title}</span>
        {meta && <span className="gz-ad-meta">{meta}</span>}
        {job.strengths[0] && !vetoed && <span className="gz-ad-strength">{job.strengths[0]}</span>}
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
              <PawStamp size={64} text={stampText(job.application)} />
            </span>
          )}
        </span>
      </button>
      <button type="button" className="gz-linkbtn gz-ad-read" onClick={onOpen} aria-label={`Read the ad: ${job.title} at ${job.company}`}>
        Read
      </button>
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
