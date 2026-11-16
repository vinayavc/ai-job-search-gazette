// In-memory run registry: one active run at a time, full event history per run,
// live listeners for SSE, and a serialized question/answer channel.
import type { AskQuestion, Command, Run, RunEvent, RunStatus } from "../../contract/types";

export const COMMANDS: readonly Command[] = ["setup", "scrape", "rank", "apply", "outcome", "gmail-sync", "interview", "upskill"];
export const ACTIVE: readonly RunStatus[] = ["queued", "running", "waiting_input"];
export const FINAL: readonly RunStatus[] = ["done", "failed", "cancelled"];
const KEEP_RUNS = 20;

type Answers = Record<string, string>;

export interface RunState {
  run: Run;
  events: RunEvent[];
  listeners: Set<(e: RunEvent) => void>;
  abort: AbortController;
  /** Called on cancel to stop the underlying query (interrupt/close). */
  stop: (() => void) | null;
  pending: { questionId: string; questions: AskQuestion[]; resolve: (a: Answers | null) => void } | null;
  questionChain: Promise<unknown>;
  files: Set<string>;
}

export class RunRegistry {
  private runs = new Map<string, RunState>();
  private currentId: string | null = null;

  get(id: string): RunState | undefined {
    return this.runs.get(id);
  }

  current(): RunState | null {
    return this.currentId ? this.runs.get(this.currentId) ?? null : null;
  }

  active(): RunState | null {
    const c = this.current();
    return c && ACTIVE.includes(c.run.status) ? c : null;
  }

  create(command: Command, args: string): RunState {
    const run: Run = {
      id: crypto.randomUUID(),
      command,
      args,
      status: "queued",
      startedAt: null,
      endedAt: null,
      summary: null,
      error: null,
    };
    const state: RunState = {
      run,
      events: [],
      listeners: new Set(),
      abort: new AbortController(),
      stop: null,
      pending: null,
      questionChain: Promise.resolve(),
      files: new Set(),
    };
    this.runs.set(run.id, state);
    this.currentId = run.id;
    this.prune();
    this.emit(state, { type: "status", run: { ...run } });
    return state;
  }

  private prune() {
    if (this.runs.size <= KEEP_RUNS) return;
    for (const [id, s] of this.runs) {
      if (this.runs.size <= KEEP_RUNS) break;
      if (id !== this.currentId && FINAL.includes(s.run.status)) this.runs.delete(id);
    }
  }

  emit(state: RunState, e: RunEvent) {
    state.events.push(e);
    for (const l of [...state.listeners]) {
      try {
        l(e);
      } catch {
        /* a broken listener must not break the run */
      }
    }
  }

  isFinal(state: RunState) {
    return FINAL.includes(state.run.status);
  }

  setStatus(state: RunState, status: RunStatus, patch: Partial<Run> = {}) {
    if (this.isFinal(state)) return;
    if (state.run.status === status && Object.keys(patch).length === 0) return;
    state.run = { ...state.run, ...patch, status };
    this.emit(state, { type: "status", run: { ...state.run } });
  }

  finish(state: RunState, status: "done" | "failed" | "cancelled", patch: { summary?: string | null; error?: string | null } = {}) {
    if (this.isFinal(state)) return;
    state.run = { ...state.run, ...patch, status, endedAt: new Date().toISOString() };
    this.emit(state, { type: "status", run: { ...state.run } });
    this.emit(state, { type: "done", run: { ...state.run } });
    if (state.pending) {
      const p = state.pending;
      state.pending = null;
      p.resolve(null);
    }
  }

  progress(state: RunState, text: string) {
    const last = [...state.events].reverse().find((e) => e.type === "progress");
    if (last && last.type === "progress" && last.text === text) return; // no duplicate ticker lines in a row
    this.emit(state, { type: "progress", text });
  }

  addFiles(state: RunState, paths: string[]) {
    const fresh = paths.filter((p) => !state.files.has(p));
    if (!fresh.length) return;
    fresh.forEach((p) => state.files.add(p));
    this.emit(state, { type: "files", paths: fresh });
  }

  /**
   * Ask the user; resolves with answers, or null if the run ended first.
   * Questions are serialized so the UI only ever has one open question.
   */
  ask(state: RunState, questions: AskQuestion[]): Promise<Answers | null> {
    const next = state.questionChain.then(
      () =>
        new Promise<Answers | null>((resolve) => {
          if (this.isFinal(state) || state.abort.signal.aborted) return resolve(null);
          const questionId = crypto.randomUUID();
          state.pending = { questionId, questions, resolve };
          this.setStatus(state, "waiting_input");
          this.emit(state, { type: "question", questionId, questions });
        }),
    );
    state.questionChain = next.catch(() => {});
    return next;
  }

  /** Returns an error string, or null on success. */
  answer(state: RunState, questionId: string, answers: Answers): string | null {
    const p = state.pending;
    if (!p) return "no question is waiting for an answer";
    if (p.questionId !== questionId) return "that question is no longer open";
    state.pending = null;
    this.setStatus(state, "running");
    p.resolve(answers);
    return null;
  }

  cancel(state: RunState) {
    if (this.isFinal(state)) return;
    state.abort.abort();
    try {
      state.stop?.();
    } catch {
      /* already stopped */
    }
    this.finish(state, "cancelled", { error: null });
  }
}
