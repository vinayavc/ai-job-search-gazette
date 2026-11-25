// "Letters to the Editor": applications still in motion, plus the errands that keep them moving.
import { useDogName } from "./dogName";
import { useState, type FormEvent } from "react";
import type { Application, Command } from "../../contract/types";
import { DachshundSleep } from "../art";

const GROUPS: { status: string; title: string; blurb: string }[] = [
  { status: "drafted", title: "On the desk", blurb: "Typed up, waiting for a stamp." },
  { status: "applied", title: "In the post", blurb: "Out in the world. Replies take their time." },
  { status: "interview", title: "Conversations", blurb: "Someone wants to chat." },
  { status: "offer", title: "Good news", blurb: "An offer on the table. Take your time." },
];

interface Props {
  applications: Application[];
  busy: boolean;
  onStart: (c: Command, args?: string) => void;
}

export function Letters({ applications, busy, onStart }: Props) {
  const dog = useDogName();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const open = applications.filter((a) => !a.isFinal);
  const known = new Set(GROUPS.map((g) => g.status));
  const groups = [
    ...GROUPS.map((g) => ({ ...g, items: open.filter((a) => a.status === g.status) })),
    { status: "other", title: "Elsewhere", blurb: "", items: open.filter((a) => !known.has(String(a.status))) },
  ].filter((g) => g.items.length > 0);

  const submitReply = (e: FormEvent) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text) { setErr("Jot down who replied and what they said, e.g. \"Acme rejected\"."); return; }
    onStart("outcome", text);
    setReply("");
    setErr(null);
    setReplying(false);
  };

  return (
    <section className="gz-letters" aria-labelledby="gz-letters-h">
      <h2 id="gz-letters-h" className="gz-section-head">Letters to the Editor</h2>
      {groups.length === 0 ? (
        <p className="gz-quiet">The letters tray is clear. When you send something out, it'll wait here.</p>
      ) : (
        <div className="gz-letter-groups">
          {groups.map((g) => (
            <div key={g.status} className="gz-letter-group">
              <h3 className="gz-subhead">{g.title}</h3>
              {g.blurb && <p className="gz-quiet">{g.blurb}</p>}
              <ul>
                {g.items.map((a) => (
                  <li key={a.rowIndex}>
                    <span className="gz-letter-who"><strong>{a.company}</strong>{a.role ? `, ${a.role}` : ""}</span>
                    {a.date && <span className="gz-letter-date"> &middot; {a.date}</span>}
                    {a.status === "interview" && (
                      <button type="button" className="gz-linkbtn" disabled={busy} onClick={() => onStart("interview", `${a.company} ${a.role}`)}>
                        Ask {dog} (interview prep)
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="gz-actions">
        <button type="button" className="gz-btn" disabled={busy} onClick={() => onStart("gmail-sync")}>Check the mailbox</button>
        <button type="button" className="gz-btn" disabled={busy} aria-expanded={replying} onClick={() => setReplying((r) => !r)}>Record a reply</button>
      </div>
      {replying && (
        <form className="gz-reply" onSubmit={submitReply}>
          <label htmlFor="gz-reply-in">Who wrote back, and what did they say?</label>
          <div className="gz-reply-row">
            <input
              id="gz-reply-in"
              type="text"
              value={reply}
              placeholder="e.g. Acme rejected"
              onChange={(e) => { setReply(e.target.value); setErr(null); }}
              aria-invalid={!!err}
              aria-describedby={err ? "gz-reply-err" : undefined}
              autoFocus
            />
            <button type="submit" className="gz-btn gz-btn-small" disabled={busy}>File it</button>
          </div>
          {err && <p id="gz-reply-err" className="gz-gentle">{err}</p>}
        </form>
      )}
      {busy && <p className="gz-quiet">{dog} is out on an errand; these will be ready when the errand's done.</p>}

      <div className="gz-selfimprove">
        <DachshundSleep size={90} />
        <div>
          <h3 className="gz-subhead">Self-improvement column</h3>
          <p className="gz-quiet">What the ads keep asking for, and a gentle study plan.</p>
          <button type="button" className="gz-linkbtn" disabled={busy} onClick={() => onStart("upskill")}>Read this week's column</button>
        </div>
      </div>
    </section>
  );
}
