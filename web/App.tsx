// Orchestrator-owned: data loading, run lifecycle, composition.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Edition, UiState, Run, RunEvent, AskQuestion, Command } from "../contract/types";
import { api, subscribeRun } from "./api";
import { DioramaHeader } from "./diorama/DioramaHeader";
import { DogNameContext } from "./paper/dogName";
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
  const [sentAt, setSentAt] = useState<number | null>(null);   // "Posted it?" answered yes -> the header plays the handover
  // "Tailor" works through your circles one /apply at a time (the commands share state files).
  const [queue, setQueue] = useState<string[]>([]);           // posting URLs still waiting for the typewriter
  const queueRef = useRef<string[]>([]);
  const setQ = useCallback((q: string[]) => { queueRef.current = q; setQueue(q); }, []);
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
        } else if (e.run.command === "apply") {
          // carry on down the list unless you stopped it; a failed one doesn't hold up the rest
          const [next, ...rest] = e.run.status === "cancelled" ? [] : queueRef.current;
          setQ(next ? rest : []);
          if (next) api.startRun({ command: "apply", args: next }).then(follow).catch((err) => { setQ([]); setError(String(err.message)); });
        }
      }
    });
  }, [reload, setQ]);

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

  const tailorAll = useCallback((urls: string[]) => {
    const [first, ...rest] = urls;
    if (!first) return;
    setError(null);
    setQ(rest);
    api.startRun({ command: "apply", args: first }).then(follow).catch((e) => { setQ([]); setError(String(e.message)); });
  }, [follow, setQ]);

  const cancel = useCallback(() => { setQ([]); if (view.run) api.cancel(view.run.id).catch(() => {}); }, [view.run, setQ]);

  return (
    <DogNameContext.Provider value={state?.dogName ?? "Doxie"}>
    <main className="gz-app">
      <DioramaHeader
        view={view}
        drafts={edition?.applications.filter((a) => a.status === "drafted").length ?? 0}
        sentAt={sentAt}
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
        tailorQueue={queue}
        onTailorAll={tailorAll}
        onCancel={cancel}
        onPatchState={patchState}
        onMarkSent={(jobKey) => api.markSent(jobKey).then(() => { setSentAt(Date.now()); return reload(); }).catch((e) => setError(String(e.message)))}
      />
      <Notepad view={view} onAnswer={answer} onCancel={cancel} />
    </main>
    </DogNameContext.Provider>
  );
}
