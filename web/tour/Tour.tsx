// The first-run tour: a welcome card with the explainer video and setup steps, then a spotlight that walks through
// the page (fetch, circle, Tailor, apply, the radio and adding a station). It opens on the first visit
// (UiState.tourSeen) and from "Take the tour" at the top of the paper. The page stays usable underneath.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { RADIO_EVENT, type RadioEventDetail } from "../diner/Radio";
import "./tour.css";

interface Step {
  id: string;
  title: string;
  body: ReactNode;
  targets?: string[];          // CSS selectors; the spotlight wraps all that exist
  radio?: RadioEventDetail;    // open the radio's dial (and the Add a station form) for this step
  wide?: boolean;              // a centred card with no spotlight
}

export interface TourProps {
  hasProfile: boolean;
  hasAds: boolean;
  dog: string;
  onClose: () => void;
  onSubscribe: () => void;
  onFetch: () => void;
}

const radio = (detail: RadioEventDetail) => window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail }));

function buildSteps({ hasProfile, dog }: { hasProfile: boolean; dog: string }): Step[] {
  return [
    {
      id: "welcome", wide: true, title: "Welcome to the Sausage Gazette",
      body: (
        <>
          <p>Here&rsquo;s the whole idea in seventeen seconds. Press play; the sound is optional.</p>
          <div className="gz-tour-video">
            <iframe src="/explainer.html?embed" title="How the Sausage Gazette works" allow="autoplay" loading="lazy" />
          </div>
        </>
      ),
    },
    hasProfile
      ? {
        id: "fetch", targets: [".fetch-tag"], title: "1. Fetch today’s edition",
        body: (
          <p>Press this each morning. The mail van goes to the press (<code>/scrape</code>), then the desk ranks the ads for you (<code>/rank</code>). It takes a few minutes. The little town shows each step, and the &ldquo;On the wire&rdquo; line says what&rsquo;s happening.</p>
        ),
      }
      : {
        id: "subscribe", targets: [".gz-subscribe .gz-btn", ".gz-subscribe"], title: "1. Start with your subscription",
        body: (
          <>
            <p>Press <b>Start my subscription</b>. It runs <code>/setup</code>, which builds your profile from your CV, a few documents or a short interview.</p>
            <p>Then press <b>Fetch today&rsquo;s edition</b> at the top left for your first ads.</p>
          </>
        ),
      },
    {
      id: "orderpad", wide: true, title: "2. Answer on the order pad",
      body: (
        <>
          <p>When {dog} needs something from you (which roles to include, whether to draft a letter, permission for an unusual step), a note slides in at the <b>bottom right</b>. Pick an answer and hand it back.</p>
          <p>Nothing is ever sent or submitted for you. You can cancel any errand from the same note.</p>
        </>
      ),
    },
    {
      id: "circle", targets: [".gz-main"], title: "3. Circle what you like",
      body: (
        <p>Click an ad to circle it in red marker; click again to let it go. <b>Read</b> opens the full ad with the desk&rsquo;s margin notes. The <b>FIT</b> stamp is the desk&rsquo;s score out of 100. New ads come first.</p>
      ),
    },
    {
      id: "tailor", targets: [".gz-circles"], title: "4. Tailor them in one go",
      body: (
        <p>Your circled ads collect here. Press <b>Tailor</b> and {dog} types a resume and cover letter for each one, one at a time. Each circle shows where it stands: not tailored, waiting, typing, pages ready, sent. The arrow folds the list away.</p>
      ),
    },
    {
      id: "apply", targets: [".gz-circles"], title: "5. Read your pages, then apply",
      body: (
        <>
          <p>Click a job in Your circles. Your tailored resume and cover letter come first, then <b>Apply on the job site</b>, which opens the posting. You fill in and send the application there yourself.</p>
          <p>Back here, answer <b>Posted it? &rarr; Yes</b> and it&rsquo;s filed in your tracker.</p>
        </>
      ),
    },
    {
      id: "radio", targets: [".dio-radio", ".dio-radio .radio-dial"], radio: { open: true }, title: "6. The radio",
      body: (
        <p>Click the radio for its dial. <b>Switch on</b>, then pick <b>Jazz</b>, <b>Lo-fi</b> or <b>Rain</b>, and set the volume. It stays quiet until you press it, and remembers what you like.</p>
      ),
    },
    {
      id: "station", targets: [".dio-radio", ".dio-radio .radio-dial"], radio: { open: true, add: true }, title: "7. Add your own station",
      body: (
        <>
          <p>Press <b>+ Add a station</b> and paste a link to a station you like. Its normal &ldquo;Listen live&rdquo; web page is fine; the Gazette finds the stream on it.</p>
          <p>Press <b>Find it</b>, give it a name, then <b>Add &amp; play</b>. It joins the dial with a red dot; <b>&times;</b> removes it.</p>
        </>
      ),
    },
    {
      id: "done", wide: true, title: "You’re all set",
      body: (
        <p>Replay this any time from <b>Take the tour</b> at the top of the paper. <b>How it works</b> plays the video on its own.</p>
      ),
    },
  ];
}

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 8, GAP = 14, MARGIN = 16;

function unionRect(selectors: string[] | undefined): Rect | null {
  if (!selectors) return null;
  let r: Rect | null = null;
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    if (!r) { r = { x: b.left, y: b.top, w: b.width, h: b.height }; continue; }
    const x = Math.min(r.x, b.left), y = Math.min(r.y, b.top);
    r = { x, y, w: Math.max(r.x + r.w, b.right) - x, h: Math.max(r.y + r.h, b.bottom) - y };
  }
  return r;
}

export function Tour({ hasProfile, hasAds, dog, onClose, onSubscribe, onFetch }: TourProps) {
  const steps = buildSteps({ hasProfile, dog });
  const [i, setI] = useState(0);
  const step = steps[i];
  const [rect, setRect] = useState<Rect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const opened = useRef(false);

  // open or close the radio's dial for the radio steps
  useEffect(() => {
    if (step.radio) { radio(step.radio); opened.current = true; }
    else if (opened.current) { radio({ open: false }); opened.current = false; }
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    if (opened.current) radio({ open: false });
    onClose();
  }, [onClose]);

  // follow the target: it can move (resize) or appear a moment later (the dial opening)
  useEffect(() => {
    let raf = 0, last = "";
    const tick = () => {
      const r = step.wide ? null : unionRect(step.targets);
      const key = r ? `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}` : "none";
      if (key !== last) { last = key; setRect(r); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // place the card next to the spotlight: below, above, then beside it; centred when there's nothing to point at
  useLayoutEffect(() => {
    const c = card.current;
    if (!c) return;
    const vw = window.innerWidth, vh = window.innerHeight, cw = c.offsetWidth, ch = c.offsetHeight;
    if (!rect || vw < 600) { setPos(null); return; }
    const r = { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
    const clampX = (x: number) => Math.min(vw - cw - MARGIN, Math.max(MARGIN, x));
    const clampY = (y: number) => Math.min(vh - ch - MARGIN, Math.max(MARGIN, y));
    let left: number, top: number;
    if (r.y + r.h + GAP + ch <= vh - MARGIN) { top = r.y + r.h + GAP; left = clampX(r.x + r.w / 2 - cw / 2); }
    else if (r.y - GAP - ch >= MARGIN) { top = r.y - GAP - ch; left = clampX(r.x + r.w / 2 - cw / 2); }
    else if (r.x + r.w + GAP + cw <= vw - MARGIN) { left = r.x + r.w + GAP; top = clampY(r.y); }
    else if (r.x - GAP - cw >= MARGIN) { left = r.x - GAP - cw; top = clampY(r.y); }
    else { left = clampX(vw - cw - MARGIN); top = clampY(vh - ch - MARGIN); }
    setPos({ left, top });
  }, [rect, i]);

  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [i]);

  const next = () => (i < steps.length - 1 ? setI(i + 1) : finish());
  const back = () => setI(Math.max(0, i - 1));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, .radio-dial")) return;
      const act = e.key === "Escape" ? finish : e.key === "ArrowRight" ? next : e.key === "ArrowLeft" ? back : null;
      if (!act) return;
      e.preventDefault(); e.stopPropagation();   // the classifieds flip pages with the arrows too
      act();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });

  const last = i === steps.length - 1;
  const finalAction = !hasProfile
    ? { label: "Start my subscription", run: () => { finish(); onSubscribe(); } }
    : !hasAds ? { label: "Fetch today’s edition", run: () => { finish(); onFetch(); } } : null;

  return (
    <div className={`gz-tour${step.wide ? " is-wide" : ""}${rect ? "" : " no-target"}`}>
      {(step.wide || !rect) && <div className="gz-tour-scrim" aria-hidden="true" />}
      {rect && !step.wide && (
        <div className="gz-tour-spot" aria-hidden="true"
          style={{ left: rect.x - PAD, top: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2 }} />
      )}
      <div ref={card} className="gz-tour-card" role="dialog" aria-modal={step.wide ? true : undefined}
        aria-labelledby="gz-tour-h" style={pos ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" } : undefined}>
        <p className="gz-tour-count">{i === 0 ? "A quick tour" : last ? "That’s the tour" : `Step ${i} of ${steps.length - 2}`}</p>
        <h2 id="gz-tour-h" ref={head} tabIndex={-1}>{step.title}</h2>
        <div className="gz-tour-body">{step.body}</div>
        <div className="gz-tour-dots" aria-hidden="true">
          {steps.map((s, k) => <span key={s.id} className={k === i ? "on" : k < i ? "seen" : ""} />)}
        </div>
        <div className="gz-tour-actions">
          {i === 0 ? (
            <>
              <button type="button" className="gz-btn gz-btn-primary" onClick={next}>Show me around &rarr;</button>
              <button type="button" className="gz-linkbtn" onClick={finish}>Skip the tour</button>
            </>
          ) : last ? (
            <>
              {finalAction && <button type="button" className="gz-btn gz-btn-primary" onClick={finalAction.run}>{finalAction.label}</button>}
              <button type="button" className={finalAction ? "gz-btn" : "gz-btn gz-btn-primary"} onClick={finish}>{finalAction ? "Look around first" : "Start reading"}</button>
              <button type="button" className="gz-linkbtn" onClick={back}>Back</button>
            </>
          ) : (
            <>
              <button type="button" className="gz-btn gz-btn-primary" onClick={next}>Next &rarr;</button>
              <button type="button" className="gz-btn" onClick={back}>Back</button>
              <button type="button" className="gz-linkbtn gz-tour-skip" onClick={finish}>End tour</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
