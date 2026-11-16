// Wire service: runs the repo's slash commands headlessly through the Claude
// Agent SDK and streams RunEvents to the Gazette over SSE.
import type { RouteHandler } from "../index";
import type { AnswerRequest, Command, RunEvent, RunRequest } from "../../contract/types";
import { COMMANDS, RunRegistry, type RunState } from "./runs";
import { runAgent, type QueryFn } from "./runner";
import { makeFakeQuery } from "./fake";

export { RunRegistry } from "./runs";
export type { QueryFn, QueryHandle, SdkLikeMessage } from "./runner";

export const ARGS_MAX = 500;
const HEARTBEAT_MS = 15_000;

export interface AgentRouteOptions {
  /** Replace the SDK's query() (tests). */
  queryFn?: QueryFn;
  /** Force fake mode on/off; defaults to env GAZETTE_FAKE_AGENT. */
  fake?: boolean;
  /** Fake-mode step delay in ms. */
  fakeStepMs?: number;
  heartbeatMs?: number;
  registry?: RunRegistry;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const err = (message: string, status: number) => json({ error: message }, status);

async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function agentRoutes(repoRoot: string, opts: AgentRouteOptions = {}): Record<string, RouteHandler> {
  const registry = opts.registry ?? new RunRegistry();
  const fakeEnv = process.env.GAZETTE_FAKE_AGENT;
  const fake = opts.fake ?? (!!fakeEnv && fakeEnv !== "0");
  const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;

  const queryFn = async (): Promise<QueryFn> => {
    if (opts.queryFn) return opts.queryFn;
    if (fake) return makeFakeQuery({ stepMs: opts.fakeStepMs });
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    return sdk.query as unknown as QueryFn;
  };

  const start = (state: RunState) => {
    runAgent({ repoRoot, registry, queryFn }, state).catch((e) => {
      registry.finish(state, "failed", { error: String((e as Error)?.message ?? e).slice(0, 600) });
    });
  };

  return {
    "POST /api/runs": async (req) => {
      const body = await readJson<RunRequest>(req);
      if (!body || typeof body !== "object") return err("expected a JSON body", 400);
      if (!COMMANDS.includes(body.command as Command)) return err(`unknown command; expected one of ${COMMANDS.join(", ")}`, 400);
      if (body.args !== undefined && typeof body.args !== "string") return err("args must be a string", 400);
      const args = (body.args ?? "").trim();
      if (/[\r\n\u0000]/.test(args)) return err("args must be a single line", 400);
      if (args.length > ARGS_MAX) return err(`args must be at most ${ARGS_MAX} characters`, 400);
      if (registry.active()) return err("another run is already in progress", 409);
      const state = registry.create(body.command, args);
      start(state);
      return json(state.run);
    },

    "GET /api/runs/current": () => json(registry.current()?.run ?? null),

    "GET /api/runs/:id/events": (req, params) => {
      const state = registry.get(params.id);
      if (!state) return err("run not found", 404);
      const enc = new TextEncoder();
      let cleanup = () => {};
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let closed = false;
          let timer: ReturnType<typeof setInterval> | null = null;
          const close = () => {
            if (closed) return;
            closed = true;
            state.listeners.delete(send);
            if (timer) clearInterval(timer);
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          };
          const write = (chunk: string) => {
            if (closed) return;
            try {
              controller.enqueue(enc.encode(chunk));
            } catch {
              close();
            }
          };
          function send(e: RunEvent) {
            write(`data: ${JSON.stringify(e)}\n\n`);
            if (e.type === "done") close();
          }
          cleanup = close;
          write(": connected\n\n");
          const past = [...state.events];
          for (const e of past) {
            send(e);
            if (closed) return;
          }
          state.listeners.add(send);
          timer = setInterval(() => write(": heartbeat\n\n"), heartbeatMs);
          req.signal?.addEventListener("abort", close, { once: true });
        },
        cancel() {
          cleanup();
        },
      });
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    },

    "POST /api/runs/:id/answer": async (req, params) => {
      const state = registry.get(params.id);
      if (!state) return err("run not found", 404);
      const body = await readJson<AnswerRequest>(req);
      if (!body || typeof body.questionId !== "string" || !body.answers || typeof body.answers !== "object") {
        return err("expected { questionId, answers }", 400);
      }
      const answers: Record<string, string> = {};
      for (const [k, v] of Object.entries(body.answers)) {
        if (typeof v !== "string") return err("answers must map question text to a string", 400);
        answers[k] = v.slice(0, 2000);
      }
      const problem = registry.answer(state, body.questionId, answers);
      if (problem) return err(problem, 409);
      return json({ ok: true });
    },

    "POST /api/runs/:id/cancel": (_req, params) => {
      const state = registry.get(params.id);
      if (!state) return err("run not found", 404);
      registry.cancel(state);
      return json(state.run);
    },
  };
}
