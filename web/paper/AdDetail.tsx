// "Page turn" reading view for one ad. Rendered in flow, in place of the classifieds.
// When the typewriter has done its work, the job's own pages come first: the tailored resume and cover letter,
// and the way to the job site, where you apply yourself.
import { useDogName } from "./dogName";
import { useEffect, useRef, useState } from "react";
import type { Job, Run } from "../../contract/types";
import { api } from "../api";
import { DachshundTypewriter, PawStamp } from "../art";
import { stampText, type TailorStatus } from "./util";

interface Props {
  job: Job;
  run: Run | null;
  status: TailorStatus;
  circled: boolean;
  onToggle: () => void;
  onBack: () => void;
  onMarkSent: (jobKey: string) => void;
}

function fileName(p: string): string {
  return p.split("/").pop() ?? p;
}

export function AdDetail({ job, status, circled, onToggle, onBack, onMarkSent }: Props) {
  const dog = useDogName();
  const headRef = useRef<HTMLHeadingElement>(null);
  const [asking, setAsking] = useState(false);
  const [noted, setNoted] = useState<null | "sent" | "later">(null);

  useEffect(() => {
    headRef.current?.focus();
    headRef.current?.scrollIntoView({ block: "nearest" });
    setAsking(false);
    setNoted(null);
  }, [job.key]);

  const app = job.application;
  const docs = app?.docs;
  const hasPages = !!(docs?.cvPdf || docs?.coverLetterPdf);
  const rows: [string, string | number | null][] = [
    ["Location", job.location],
    ["Apply by", job.deadline],
    ["Posted", job.postedDate],
    ["First seen", job.firstSeen],
    ["Applicants", job.applicants],
    ["Found on", job.portal],
  ];

  // You apply on the job site yourself; the Gazette only asks afterwards so it can file it.
  const goApply = () => {
    window.open(job.url, "_blank", "noopener,noreferrer");
    setAsking(true);
    setNoted(null);
  };

  return (
    <article className="gz-detail" aria-labelledby="gz-detail-h">
      <button type="button" className="gz-linkbtn gz-back" onClick={onBack}>
        &larr; Back to the classifieds
      </button>

      <header className="gz-detail-head">
        <h2 id="gz-detail-h" ref={headRef} tabIndex={-1} className={job.vetoed ? "is-struck" : undefined}>
          {job.title}
        </h2>
        <p className="gz-detail-company">{job.company}</p>
        {job.rankVerdict && (
          <p className="gz-verdict">
            The desk's verdict: <em>{job.rankVerdict}</em>
            {job.rankScore !== null && <span className="gz-stamp gz-stamp-inline">FIT {job.rankScore}</span>}
          </p>
        )}
        {!job.rankVerdict && job.rankScore === null && <p className="gz-verdict">Not yet read closely by the desk.</p>}
        {app && (
          <div className="gz-detail-paw"><PawStamp size={84} text={stampText(app)} /></div>
        )}
      </header>

      <section className={`gz-ready is-${status}`} aria-labelledby="gz-ready-h">
        <h3 id="gz-ready-h" className="gz-subhead">
          {hasPages ? (status === "sent" ? "Your pages, as sent" : "Your pages are ready") : "Your pages"}
        </h3>

        {status === "typing" && (
          <div className="gz-typing" role="status">
            <DachshundTypewriter size={160} />
            <p>{dog} is at the typewriter, tailoring your resume and cover letter&hellip;</p>
          </div>
        )}
        {status === "queued" && <p className="gz-quiet" role="status">Waiting its turn at the typewriter. {dog} will get to it next.</p>}
        {status === "todo" && (
          circled
            ? <p className="gz-quiet">Not tailored yet. Press <strong>Tailor</strong> in Your circles and {dog} will type up a resume and cover letter for this one.</p>
            : (
              <p className="gz-quiet">
                Circle it, then press <strong>Tailor</strong> in Your circles.{" "}
                <button type="button" className="gz-btn gz-btn-small" onClick={onToggle}>Circle this ad</button>
              </p>
            )
        )}
        {status === "skip" && !hasPages && <p className="gz-quiet">The desk marked this one as not for you, so it isn't sent to the typewriter.</p>}

        {hasPages && docs && (
          <>
            <div className="gz-pages">
              {docs.cvPdf && (
                <figure className="gz-page">
                  <iframe src={api.fileUrl(docs.cvPdf)} title={`Resume for ${job.company}`} />
                  <figcaption><a href={api.fileUrl(docs.cvPdf)} target="_blank" rel="noopener noreferrer">Open the resume</a></figcaption>
                </figure>
              )}
              {docs.coverLetterPdf && (
                <figure className="gz-page">
                  <iframe src={api.fileUrl(docs.coverLetterPdf)} title={`Cover letter for ${job.company}`} />
                  <figcaption><a href={api.fileUrl(docs.coverLetterPdf)} target="_blank" rel="noopener noreferrer">Open the cover letter</a></figcaption>
                </figure>
              )}
            </div>
            {status !== "sent" && (
              <div className="gz-actions gz-apply-row">
                <button type="button" className="gz-btn gz-btn-primary" onClick={goApply}>Apply on the job site &rarr;</button>
                <span className="gz-quiet">Opens the posting in a new tab. You send it yourself; the Gazette never does.</span>
              </div>
            )}
          </>
        )}

        {asking && (
          <div className="gz-posted" role="group" aria-label="Did you post the application?">
            <span>Posted it?</span>
            <button type="button" className="gz-btn gz-btn-small" onClick={() => { onMarkSent(job.key); setAsking(false); setNoted("sent"); }}>Yes</button>
            <button type="button" className="gz-btn gz-btn-small" onClick={() => { setAsking(false); setNoted("later"); }}>Not yet</button>
          </div>
        )}
        {noted === "sent" && <p className="gz-quiet" role="status">Filed under letters sent. Nicely done.</p>}
        {noted === "later" && <p className="gz-quiet" role="status">No rush. It'll keep.</p>}
      </section>

      <div className="gz-detail-grid">
        <div className="gz-detail-main">
          <dl className="gz-facts">
            {rows.filter(([, v]) => v !== null && v !== "").map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>
            ))}
          </dl>

          {(job.vetoed || job.flagged) && (
            <div className="gz-notes-box">
              {job.vetoed && <p><strong>Not for you:</strong> {job.locationVerdict === "FAIL" ? "the location doesn't suit." : ""} {job.languageGate === "FAIL" ? (job.languageNote ?? "a language you haven't listed.") : ""}</p>}
              {job.locationVerdict === "FLAG" && <p>The location is worth a second look.</p>}
              {job.languageGate === "FLAG" && <p>Language: {job.languageNote ?? "worth a second look."}</p>}
              {job.guard && job.guard !== "clean" && <p>A note from the desk: {job.guard}</p>}
            </div>
          )}

          <div className="gz-actions">
            <a className="gz-btn" href={job.url} target="_blank" rel="noopener noreferrer">See the original posting</a>
            {circled && <button type="button" className="gz-linkbtn gz-small" onClick={onToggle}>Uncircle</button>}
          </div>

          {docs && (docs.interviewPrep.length > 0 || docs.outcome) && (
            <ul className="gz-doclinks">
              {docs.interviewPrep.map((p) => (
                <li key={p}><a href={api.fileUrl(p)} target="_blank" rel="noopener noreferrer">{fileName(p)}</a></li>
              ))}
              {docs.outcome && <li><a href={api.fileUrl(docs.outcome)} target="_blank" rel="noopener noreferrer">{fileName(docs.outcome)}</a></li>}
            </ul>
          )}
        </div>

        <aside className="gz-margin" aria-label="Margin notes">
          {job.strengths.length > 0 && (
            <div className="gz-hand gz-hand-ink">
              <p className="gz-hand-head">good bits</p>
              <ul>{job.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {job.gaps.length > 0 && (
            <div className="gz-hand gz-hand-red">
              <p className="gz-hand-head">worth knowing</p>
              <ul>{job.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {job.strengths.length === 0 && job.gaps.length === 0 && (
            <p className="gz-hand gz-hand-ink">No margin notes yet. Ranking adds them.</p>
          )}
        </aside>
      </div>

      <button type="button" className="gz-linkbtn gz-back" onClick={onBack}>
        &larr; Back to the classifieds
      </button>
    </article>
  );
}
