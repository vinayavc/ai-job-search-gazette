// The waiter's order pad: slides in from the right while Doxie runs an errand or has a question.
import { useMemo, useState, type FormEvent } from "react";
import type { RunView } from "../App";
import type { AskQuestion } from "../../contract/types";
import { commandWords, isActive, isFinished } from "./util";
import "./notepad.css";

export interface NotepadProps { view: RunView; onAnswer: (answers: Record<string, string>) => void; onCancel: () => void }

const OTHER = "__other__";

function QuestionForm({ questions, onAnswer }: { questions: AskQuestion[]; onAnswer: NotepadProps["onAnswer"] }) {
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [other, setOther] = useState<Record<number, string>>({});
  const [missing, setMissing] = useState<number[]>([]);

  const answerFor = (i: number): string => {
    const labels = (picked[i] ?? []).filter((l) => l !== OTHER);
    const extra = (picked[i] ?? []).includes(OTHER) || questions[i].options.length === 0 ? (other[i] ?? "").trim() : "";
    return [...labels, ...(extra ? [extra] : [])].join(", ");
  };

  const pick = (i: number, label: string, multi: boolean) => {
    setMissing((m) => m.filter((x) => x !== i));
    setPicked((p) => {
      const cur = p[i] ?? [];
      if (!multi) return { ...p, [i]: [label] };
      return { ...p, [i]: cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label] };
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const empty = questions.map((_, i) => i).filter((i) => !answerFor(i));
    if (empty.length) { setMissing(empty); return; }
    const out: Record<string, string> = {};
    questions.forEach((q, i) => { out[q.question] = answerFor(i); });
    onAnswer(out);
  };

  return (
    <form className="np-form" onSubmit={submit} noValidate>
      {questions.map((q, i) => {
        const multi = !!q.multiSelect;
        const name = `np-q-${i}`;
        const freeOnly = q.options.length === 0;
        const otherOn = (picked[i] ?? []).includes(OTHER);
        return (
          <fieldset key={i} className="np-q" aria-invalid={missing.includes(i)} aria-describedby={missing.includes(i) ? `${name}-err` : undefined}>
            {q.header && <legend className="np-q-header">{q.header}</legend>}
            <p className="np-q-text">{q.question}</p>
            {q.options.map((o) => (
              <label key={o.label} className="np-opt">
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={name}
                  checked={(picked[i] ?? []).includes(o.label)}
                  onChange={() => pick(i, o.label, multi)}
                />
                <span>
                  <span className="np-opt-label">{o.label}</span>
                  {o.description && <span className="np-opt-desc">{o.description}</span>}
                </span>
              </label>
            ))}
            {!freeOnly && (
              <label className="np-opt">
                <input type={multi ? "checkbox" : "radio"} name={name} checked={otherOn} onChange={() => pick(i, OTHER, multi)} />
                <span className="np-opt-label">Other</span>
              </label>
            )}
            {(freeOnly || otherOn) && (
              <input
                type="text"
                className="np-other"
                aria-label={freeOnly ? q.question : "Your own answer"}
                placeholder="Write it in…"
                value={other[i] ?? ""}
                onChange={(e) => { setOther((o) => ({ ...o, [i]: e.target.value })); setMissing((m) => m.filter((x) => x !== i)); }}
              />
            )}
            {missing.includes(i) && <p id={`${name}-err`} className="np-gentle">Pick one, or write a few words, whenever you're ready.</p>}
          </fieldset>
        );
      })}
      <button type="submit" className="np-btn">Hand it to Doxie</button>
    </form>
  );
}

export function Notepad({ view, onAnswer, onCancel }: NotepadProps) {
  const { run, question, log } = view;
  const active = isActive(run);
  const finished = isFinished(run);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const visible = !!question || (!!run && (active || (finished && dismissed !== run.id)));
  const tail = useMemo(() => {
    const t = log.trim();
    return t.length > 600 ? "…" + t.slice(-600) : t;
  }, [log]);

  if (!visible || !run) {
    return <div className="np-wrap" aria-hidden="true" />;
  }

  const title = commandWords(run.command);
  return (
    <div className="np-wrap is-open">
      <section className="np-pad" aria-label={`Order pad: ${title}`} role="complementary">
        <div className="np-spiral" aria-hidden="true" />
        <h2 className="np-title">{title}</h2>
        {run.args && <p className="np-args">{run.args}</p>}

        {question ? (
          <div role="group" aria-label="Doxie has a question">
            <p className="np-ask">Doxie has a question for you:</p>
            <QuestionForm key={question.questionId} questions={question.questions} onAnswer={onAnswer} />
          </div>
        ) : (
          <>
            {active && (
              <p className="np-status" role="status">
                {run.status === "queued" ? "Waiting for the cook…" : "Working on it…"}
              </p>
            )}
            {tail && <pre className="np-log" aria-live="polite">{tail}</pre>}
          </>
        )}

        {finished && !question && (
          <div className="np-done" role="status">
            {run.status === "done" && !(run.summary && view.log.trim().endsWith(run.summary.trim())) && <p>{run.summary ?? "All done."}</p>}
            {run.status === "cancelled" && <p>Put that one aside. No harm done.</p>}
            {run.status === "failed" && (
              <p className="np-gentle">
                That didn't quite go to plan{run.error ? `: ${run.error}` : "."} You can try again whenever you like.
              </p>
            )}
            <button type="button" className="np-btn" onClick={() => setDismissed(run.id)}>Tear off the page</button>
          </div>
        )}

        {active && (
          <button type="button" className="np-link" onClick={onCancel}>Cancel this errand</button>
        )}
      </section>
    </div>
  );
}
