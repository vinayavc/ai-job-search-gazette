import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type { Options, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { Run, RunEvent } from "../../contract/types";
import { agentRoutes, RunRegistry, type QueryFn, type SdkLikeMessage } from "./index";
import { makeFakeQuery } from "./fake";
import { bashProgress, progressFor, redact } from "./progress";
import { authErrorMessage, findClaudeCli } from "./auth";

const repoRoot = resolve(import.meta.dir, "..", "..", "..");

type Script = (options: Options) => AsyncGenerator<SdkLikeMessage>;

function scripted(script: Script): QueryFn {
  return ({ options }) => {
    const it = script(options);
    return Object.assign(it, { interrupt: async () => void (await it.return(undefined)), close: () => void it.return(undefined) });
  };
}

function setup(queryFn: QueryFn) {
  const registry = new RunRegistry();
  const routes = agentRoutes(repoRoot, { queryFn, registry, heartbeatMs: 50 });
  const call = async (key: string, params: Record<string, string> = {}, body?: unknown) => {
    const [method, path] = key.split(" ");
    const req = new Request("http://x" + path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    return routes[key](req, params);
  };
  const startRun = async (command: string, args?: string) => {
    const res = await call("POST /api/runs", {}, { command, args });
    return { res, run: (await res.json()) as Run & { error?: string } };
  };
  return { registry, call, startRun };
}

async function waitFor<T>(fn: () => T | undefined | null | false, ms = 2000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await Bun.sleep(5);
  }
}

const sleepAbortable = (signal: AbortSignal | undefined) =>
  new Promise<void>((_, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));

const success = (result: string): SdkLikeMessage => ({ type: "result", subtype: "success", is_error: false, result });

function tool(name: string, input: Record<string, unknown>, id: string = crypto.randomUUID()): SdkLikeMessage {
  return { type: "assistant", parent_tool_use_id: null, message: { id: "m" + id, content: [{ type: "tool_use", id, name, input }] } };
}
const toolResult = (id: string, isError = false): SdkLikeMessage => ({
  type: "user",
  message: { content: [{ type: "tool_result", tool_use_id: id, is_error: isError, content: "x" }] },
});

async function readSse(res: Response, until: (events: RunEvent[]) => boolean = (ev) => ev.some((e) => e.type === "done")) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const events: RunEvent[] = [];
  let comments = 0;
  while (!until(events)) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (chunk.startsWith(":")) comments++;
      else if (chunk.startsWith("data: ")) events.push(JSON.parse(chunk.slice(6)));
    }
  }
  reader.releaseLock();
  return { events, comments };
}

describe("runs API", () => {
  test("validates command and args", async () => {
    const { startRun } = setup(scripted(async function* () { yield success("ok"); }));
    expect((await startRun("deploy")).res.status).toBe(400);
    expect((await startRun("apply", "a\nb")).res.status).toBe(400);
    expect((await startRun("apply", "x".repeat(501))).res.status).toBe(400);
  });

  test("only one active run: second POST is 409, allowed again after cancel", async () => {
    const { startRun, call } = setup(scripted(async function* (o) { await sleepAbortable(o.abortController?.signal); }));
    const a = await startRun("scrape");
    expect(a.res.status).toBe(200);
    expect(["queued", "running"]).toContain(a.run.status);
    const b = await startRun("rank");
    expect(b.res.status).toBe(409);
    const cur = (await (await call("GET /api/runs/current")).json()) as Run;
    expect(cur.id).toBe(a.run.id);
    const c = (await (await call("POST /api/runs/:id/cancel", { id: a.run.id })).json()) as Run;
    expect(c.status).toBe("cancelled");
    expect((await startRun("rank")).res.status).toBe(200);
  });

  test("passes the slash command, cwd, settings and system prompt to the SDK", async () => {
    let seen: { prompt: string; options: Options } | null = null;
    const q: QueryFn = (p) => {
      seen = p;
      return (async function* () { yield success("ok"); })();
    };
    const { startRun, registry } = setup(q);
    const { run } = await startRun("apply", "  https://example.com/job/1  ");
    await waitFor(() => registry.get(run.id)!.run.status === "done");
    expect(seen!.prompt).toBe("/apply https://example.com/job/1");
    expect(seen!.options.cwd).toBe(repoRoot);
    expect(seen!.options.settingSources).toContain("project");
    expect(seen!.options.settingSources).toContain("user");
    expect(JSON.stringify(seen!.options.systemPrompt)).toContain("AskUserQuestion");
    expect(JSON.stringify(seen!.options.systemPrompt)).toContain("Sausage Gazette");
  });

  test("SSE replays past events, then streams live ones and closes after done", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { startRun, call, registry } = setup(
      scripted(async function* () {
        yield tool("Bash", { command: "python3 tools/rank_state.py pending --token=abc" });
        await gate;
        yield { type: "assistant", parent_tool_use_id: null, message: { id: "t1", content: [{ type: "text", text: "All ranked." }] } };
        yield success("Ranked 3 postings.");
      }),
    );
    const { run } = await startRun("rank");
    await waitFor(() => registry.get(run.id)!.events.some((e) => e.type === "progress"));
    const res = await call("GET /api/runs/:id/events", { id: run.id });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reading = readSse(res);
    await Bun.sleep(120); // let a heartbeat through
    release();
    const { events, comments } = await reading;
    expect(events[0]).toMatchObject({ type: "status", run: { status: "queued" } });
    expect(events.map((e) => e.type)).toEqual(["status", "status", "progress", "log", "status", "done"]);
    expect(events).toContainEqual({ type: "progress", text: "Ranking desk is scoring postings" });
    expect(JSON.stringify(events)).not.toContain("abc");
    const done = events.at(-1) as Extract<RunEvent, { type: "done" }>;
    expect(done.run).toMatchObject({ status: "done", summary: "Ranked 3 postings." });
    expect(comments).toBeGreaterThanOrEqual(2); // ": connected" + heartbeat

    // A late subscriber gets the full replay and the stream ends by itself.
    const again = await readSse(await call("GET /api/runs/:id/events", { id: run.id }), () => false);
    expect(again.events).toEqual(events);
  });

  test("streams partial text as log events without duplicating the final message", async () => {
    const { startRun, registry } = setup(
      scripted(async function* () {
        yield { type: "stream_event", parent_tool_use_id: null, event: { type: "message_start", message: { id: "m1" } } };
        yield { type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_start", content_block: { type: "text" } } };
        yield { type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } } };
        yield { type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_delta", delta: { type: "text_delta", text: "world" } } };
        yield { type: "assistant", parent_tool_use_id: null, message: { id: "m1", content: [{ type: "text", text: "Hello world" }] } };
        yield { type: "assistant", parent_tool_use_id: null, message: { id: "m2", content: [{ type: "text", text: "Second." }] } };
        yield success("x".repeat(900));
      }),
    );
    const { run } = await startRun("rank");
    await waitFor(() => registry.get(run.id)!.run.status === "done");
    const s = registry.get(run.id)!;
    const log = s.events.filter((e) => e.type === "log").map((e) => (e as { text: string }).text).join("");
    expect(log).toBe("Hello world\n\nSecond.");
    expect(s.run.summary!.length).toBeLessThanOrEqual(600);
  });

  test("AskUserQuestion round trip returns answers to the tool", async () => {
    let toolResultSeen: PermissionResult | null = null;
    const questions = [{ question: "Proceed with drafting?", header: "Draft?", multiSelect: false, options: [{ label: "Yes", description: "go" }, { label: "No", description: "stop" }] }];
    const { startRun, call, registry } = setup(
      scripted(async function* (o) {
        toolResultSeen = await o.canUseTool!("AskUserQuestion", { questions }, { signal: o.abortController!.signal } as never);
        yield success("done");
      }),
    );
    const { run } = await startRun("apply", "https://example.com/j");
    const s = registry.get(run.id)!;
    const q = await waitFor(() => s.events.find((e) => e.type === "question") as Extract<RunEvent, { type: "question" }> | undefined);
    expect(q.questions).toEqual([{ question: "Proceed with drafting?", header: "Draft?", multiSelect: undefined, options: [{ label: "Yes", description: "go" }, { label: "No", description: "stop" }] }]);
    expect(s.run.status).toBe("waiting_input");
    expect((await (await call("GET /api/runs/current")).json()).status).toBe("waiting_input");

    expect((await call("POST /api/runs/:id/answer", { id: run.id }, { questionId: "nope", answers: {} })).status).toBe(409);
    const ok = await call("POST /api/runs/:id/answer", { id: run.id }, { questionId: q.questionId, answers: { "Proceed with drafting?": "Yes" } });
    expect(await ok.json()).toEqual({ ok: true });
    await waitFor(() => s.run.status === "done");
    expect(toolResultSeen!).toEqual({ behavior: "allow", updatedInput: { questions, answers: { "Proceed with drafting?": "Yes" } } });
    const statuses = s.events.filter((e) => e.type === "status").map((e) => (e as { run: Run }).run.status);
    expect(statuses).toEqual(["queued", "running", "waiting_input", "running", "done"]);
  });

  test("permission relay: safe tools auto-allowed, outside writes denied, others asked as Allow/Deny", async () => {
    const results: Record<string, PermissionResult | null> = {};
    const { startRun, call, registry } = setup(
      scripted(async function* (o) {
        const ask = (name: string, input: Record<string, unknown>) => o.canUseTool!(name, input, { signal: o.abortController!.signal } as never);
        results.read = await ask("Read", { file_path: "/etc/hosts" });
        results.webfetch = await ask("WebFetch", { url: "https://x.com" });
        results.writeIn = await ask("Write", { file_path: resolve(repoRoot, "cv/x.tex"), content: "" });
        results.writeOut = await ask("Write", { file_path: "/tmp/evil.txt", content: "" });
        results.escape = await ask("Edit", { file_path: resolve(repoRoot, "../outside.txt") });
        results.bashDeny = await ask("Bash", { command: "rm -rf build --token=sekrit", description: "Delete the build folder" });
        results.bashAllow = await ask("Bash", { command: "make", description: "Build things" });
        results.protected = await ask("Edit", { file_path: resolve(repoRoot, "tools/rank_state.py") });
        yield success("ok");
      }),
    );
    const { run } = await startRun("rank");
    const s = registry.get(run.id)!;
    const answerNext = async (n: number, label: string) => {
      const q = await waitFor(() => s.events.filter((e) => e.type === "question")[n] as Extract<RunEvent, { type: "question" }> | undefined);
      await call("POST /api/runs/:id/answer", { id: run.id }, { questionId: q.questionId, answers: { [q.questions[0].question]: label } });
      return q;
    };
    const q0 = await answerNext(0, "Deny");
    expect(q0.questions[0].question).toBe("Allow the assistant to run: Delete the build folder?");
    expect(q0.questions[0].options.map((o) => o.label)).toEqual(["Allow", "Deny"]);
    expect(JSON.stringify(q0)).not.toContain("sekrit");
    const q1 = await answerNext(1, "Allow");
    expect(q1.questions[0].question).toBe("Allow the assistant to run: Build things?");
    const q2 = await answerNext(2, "Allow");
    expect(q2.questions[0].question).toBe("Allow the assistant to run: edit tools/rank_state.py?");
    await waitFor(() => s.run.status === "done");

    expect(results.read!.behavior).toBe("allow");
    expect(results.webfetch!.behavior).toBe("allow");
    expect(results.writeIn!.behavior).toBe("allow");
    expect(results.writeOut!.behavior).toBe("deny");
    expect(results.escape!.behavior).toBe("deny");
    expect(results.bashDeny!.behavior).toBe("deny");
    expect(results.bashAllow!.behavior).toBe("allow");
    expect(results.protected!.behavior).toBe("allow");
    expect(s.events.filter((e) => e.type === "question").length).toBe(3);
  });

  test("cancel aborts the query, resolves the pending question as denied, and ends the stream", async () => {
    let res: PermissionResult | null | undefined;
    let aborted = false;
    const { startRun, call, registry } = setup(
      scripted(async function* (o) {
        o.abortController!.signal.addEventListener("abort", () => (aborted = true));
        res = await o.canUseTool!("AskUserQuestion", { questions: [{ question: "Q?", header: "h", options: [] }] }, { signal: o.abortController!.signal } as never);
        yield success("should not finish");
      }),
    );
    const { run } = await startRun("scrape");
    const s = registry.get(run.id)!;
    await waitFor(() => s.run.status === "waiting_input");
    const sse = readSse(await call("GET /api/runs/:id/events", { id: run.id }));
    const c = (await (await call("POST /api/runs/:id/cancel", { id: run.id })).json()) as Run;
    expect(c.status).toBe("cancelled");
    expect(c.endedAt).not.toBeNull();
    await waitFor(() => res !== undefined);
    expect(res!.behavior).toBe("deny");
    expect(aborted).toBe(true);
    const { events } = await sse;
    expect(events.at(-1)).toMatchObject({ type: "done", run: { status: "cancelled" } });
    await Bun.sleep(20);
    expect(s.run.status).toBe("cancelled");
  });

  test("auth failures become a friendly sign-in message", async () => {
    for (const q of [
      scripted(async function* () { throw new Error("Invalid API key · Please run /login"); }),
      scripted(async function* () {
        yield { type: "assistant", error: "authentication_failed", parent_tool_use_id: null, message: { id: "a", content: [{ type: "text", text: "nope" }] } };
        yield { type: "result", subtype: "success", is_error: true, result: "OAuth token has expired" };
      }),
      makeFakeQuery({ stepMs: 2, mode: "auth" }),
    ]) {
      const { startRun, registry } = setup(q);
      const { run } = await startRun("scrape");
      await waitFor(() => registry.get(run.id)!.run.status === "failed");
      const err = registry.get(run.id)!.run.error!;
      expect(err.startsWith("Claude isn't signed in. In a terminal run: ")).toBe(true);
      expect(err.endsWith(" auth login")).toBe(true);
    }
    const bin = findClaudeCli();
    if (bin) expect(authErrorMessage(repoRoot)).toContain("ui/node_modules/@anthropic-ai/claude-agent-sdk-");
  });

  test("other errors fail the run with the error text", async () => {
    const { startRun, registry } = setup(scripted(async function* () { yield { type: "result", subtype: "error_max_turns", is_error: true, errors: [] }; }));
    const { run } = await startRun("rank");
    await waitFor(() => registry.get(run.id)!.run.status === "failed");
    expect(registry.get(run.id)!.run.error).toContain("turn limit");
  });

  test("files event lists repo-relative paths of successful writes only", async () => {
    const { startRun, registry } = setup(
      scripted(async function* (o) {
        yield tool("Write", { file_path: resolve(o.cwd!, "cv/A.tex") }, "w1");
        yield toolResult("w1");
        yield tool("Edit", { file_path: resolve(o.cwd!, "cover_letters/B.tex") }, "w2");
        yield toolResult("w2", true);
        yield tool("NotebookEdit", { notebook_path: "notes/C.ipynb" }, "w3");
        yield toolResult("w3");
        yield tool("Write", { file_path: resolve(o.cwd!, "cv/A.tex") }, "w4");
        yield toolResult("w4");
        yield success("ok");
      }),
    );
    const { run } = await startRun("apply");
    await waitFor(() => registry.get(run.id)!.run.status === "done");
    const files = registry.get(run.id)!.events.filter((e) => e.type === "files");
    expect(files).toEqual([{ type: "files", paths: ["cv/A.tex"] }, { type: "files", paths: ["notes/C.ipynb"] }]);
    const progress = registry.get(run.id)!.events.filter((e) => e.type === "progress").map((e) => (e as { text: string }).text);
    expect(progress).toContain("Typesetting A.tex");
    expect(progress).toContain("Typesetting C.ipynb");
  });

  test("fake mode plays a full apply run with a question and files", async () => {
    const { startRun, call, registry } = setup(makeFakeQuery({ stepMs: 3 }));
    const { run } = await startRun("apply", "https://example.com/job");
    const s = registry.get(run.id)!;
    const q = await waitFor(() => s.events.find((e) => e.type === "question") as Extract<RunEvent, { type: "question" }> | undefined);
    await call("POST /api/runs/:id/answer", { id: run.id }, { questionId: q.questionId, answers: { [q.questions[0].question]: q.questions[0].options[0].label } });
    await waitFor(() => s.run.status === "done");
    expect(s.events.some((e) => e.type === "files")).toBe(true);
    expect(s.events.filter((e) => e.type === "progress").length).toBeGreaterThan(3);
    expect(s.run.summary).toBeTruthy();
  });
});

describe("progress lines", () => {
  test("maps tools to friendly ticker lines", () => {
    expect(bashProgress("python3 tools/rank_state.py record --x")).toBe("Ranking desk is scoring postings");
    expect(bashProgress("cd /repo && bun run .agents/skills/linkedin-search/cli/src/cli.ts search -q x")).toBe("Checking LinkedIn");
    expect(bashProgress("bun run .agents/skills/job-bank-search/cli/src/cli.ts search")).toBe("Checking Job Bank");
    expect(bashProgress("lualatex -interaction=nonstopmode cv/x.tex")).toBe("Running the printing press");
    expect(bashProgress("curl -H 'Authorization: Bearer xyz' https://a")).toBe("Working at the desk");
    expect(progressFor("WebFetch", { url: "https://www.example.com/jobs/1?token=s3cret" })).toBe("Reading a posting at example.com");
    expect(progressFor("Task", { prompt: "x" })).toBe("Sending a reporter out");
    expect(progressFor("Agent", { prompt: "x" })).toBe("Sending a reporter out");
    expect(progressFor("Write", { file_path: "/a/b/cv/Resume.tex" })).toBe("Typesetting Resume.tex");
    expect(progressFor("Edit", { file_path: "cover_letters/C.tex" })).toBe("Typesetting C.tex");
    expect(progressFor("WebSearch", { query: "x" })).toBe("Searching the wires");
    expect(progressFor("SomethingNew", {})).toBeNull();
  });

  test("redacts secrets in permission details", () => {
    const r = redact("curl -H 'Authorization: Bearer abc.def' https://x?api_key=123 TOKEN=zzz sk-ant-abcdefghijkl");
    expect(r).not.toContain("abc.def");
    expect(r).not.toContain("123");
    expect(r).not.toContain("zzz");
    expect(r).not.toContain("sk-ant-abcdefghijkl");
  });
});
