// Orchestrator-owned: data loading, run lifecycle, composition.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Edition, UiState, Run, RunEvent, AskQuestion, Command } from "../contract/types";
import { api, subscribeRun } from "./api";
import { DinerScene } from "./diner/DinerScene";
import { Newspaper } from "./paper/Newspaper";
import { Notepad } from "./paper/Notepad";

export interface RunView {
  run: Run | null;
  ticker: string[];           // recent progress lines, newest last
  log: string;                // streamed assistant prose
  files: string[];
  question: { questionId: string; questions: AskQuestion[] } | null;
}

const EMPTY: RunView = { run: null, ticker: [], log: "", files: [], question: null };

export function App() {
  const [edition, setEdition] = useState<Edition | null>(null);
  const [state, setState] = useState<UiState | null>(null);
  const [view, setView] = useState<RunView>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const unsub = useRef<null | (() => void)>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(() => api.edition().then(setEdition).catch((e) => setError(String(e.message))), []);

  const follow = useCallback((run: Run) => {
    unsub.current?.();
    setView({ ...EMPTY, run });
    unsub.current = subscribeRun(run.id, (e: RunEvent) => {
      setView((v) => {
        switch (e.type) {
          case "status": return { ...v, run: e.run, question: e.run.status === "waiting_input" ? v.question : null };
          case "progress": return { ...v, ticker: [...v.ticker, e.text].slice(-6) };
          case "log": return { ...v, log: v.log + e.text };
          case "files": return { ...v, files: [...v.files, ...e.paths] };
          case "question": return { ...v, question: { questionId: e.questionId, questions: e.questions } };
          case "done": return { ...v, run: e.run, question: null };
        }
      });
      if (e.type === "done") {
        unsub.current?.();
        reload();
        if (e.run.command === "scrape" && e.run.status === "done" && stateRef.current?.autoRank) {
          api.startRun({ command: "rank" }).then(follow).catch((err) => setError(String(err.message)));
        }
      }
    });
  }, [reload]);

  useEffect(() => {
    reload();
    api.state().then(setState).catch((e) => setError(String(e.message)));
    api.currentRun()
      .then((r) => r && ["queued", "running", "waiting_input"].includes(r.status) && follow(r))
      .catch(() => {});
    return () => unsub.current?.();
  }, [reload, follow]);

  const start = useCallback((command: Command, args?: string) => {
    setError(null);
    api.startRun({ command, args }).then(follow).catch((e) => setError(String(e.message)));
  }, [follow]);

  // Computes each patch from the latest state (so rapid clicks never use a stale
  // snapshot) and saves in order; the server's echo is not applied, so an older
  // response can never overwrite a newer optimistic state.
  const saveChain = useRef(Promise.resolve());
  const patchState = useCallback((patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => {
    const cur = stateRef.current;
    if (!cur) return;
    const p = typeof patch === "function" ? patch(cur) : patch;
    const next = { ...cur, ...p };
    stateRef.current = next;
    setState(next);
    saveChain.current = saveChain.current
      .then(() => api.saveState(p))
      .then(() => {}, (e) => setError(String(e.message)));
  }, []);

  const answer = useCallback((answers: Record<string, string>) => {
    if (!view.run || !view.question) return;
    const questionId = view.question.questionId;
    setView((v) => ({ ...v, question: null }));
    api.answer(view.run.id, { questionId, answers }).catch((e) => setError(String(e.message)));
  }, [view.run, view.question]);

  const cancel = useCallback(() => { if (view.run) api.cancel(view.run.id).catch(() => {}); }, [view.run]);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "16px" }}>
      <DinerScene
        view={view}
        onFetch={() => start("scrape")}
        radio={state?.radio ?? { station: "jazz", volume: 0.4, on: false }}
        onRadioChange={(radio) => patchState({ radio })}
      />
      {error && <div role="alert" style={{ background: "#f3ead6", border: "1px solid #c0392b", color: "#7a1f14", padding: "6px 10px", margin: "8px 0" }}>{error}</div>}
      <Newspaper
        edition={edition}
        state={state}
        view={view}
        onStart={start}
        onCancel={cancel}
        onPatchState={patchState}
        onMarkSent={(jobKey) => api.markSent(jobKey).then(reload).catch((e) => setError(String(e.message)))}
      />
      <Notepad view={view} onAnswer={answer} onCancel={cancel} />
    </main>
  );
}
