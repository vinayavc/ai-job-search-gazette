// Drives one slash-command run through the Claude Agent SDK (or an injected
// stand-in) and translates SDK messages into RunEvents.
import type { CanUseTool, Options, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { AskQuestion } from "../../contract/types";
import type { RunRegistry, RunState } from "./runs";
import { authErrorMessage, looksLikeAuthError } from "./auth";
import { progressFor, redact, repoRelative, writePath, WRITE_TOOLS } from "./progress";

/** Loose view of SDK messages; we only read the fields we need. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SdkLikeMessage = { type: string; [k: string]: any };
export interface QueryHandle extends AsyncIterable<SdkLikeMessage> {
  interrupt?: () => Promise<unknown>;
  close?: () => void;
}
export type QueryFn = (params: { prompt: string; options: Options }) => QueryHandle;

export const SYSTEM_APPEND = [
  "You are running headlessly behind the Sausage Gazette, a local web UI for this job-search repo.",
  "The user cannot read or reply to plain chat text mid-run: the ONLY way to ask them anything (confirmations, choices, missing details) is the AskUserQuestion tool. Never end a turn with a question in prose; ask it with AskUserQuestion and continue with the answer.",
  "Keep every question to the AskUserQuestion tool with short, concrete options.",
  "Never submit job application forms, and never send emails, messages or posts on the user's behalf. Prepare drafts and links; the user submits and sends themselves.",
  "Finish with a brief plain-text summary of what you did and which files changed.",
].join("\n");

const SAFE_TOOLS = new Set(["Read", "Glob", "Grep", "WebSearch", "WebFetch", "TodoWrite", "Task", "Agent", "Skill"]);
/** Mirrors the project's `permissions.ask` list: in-repo writes here still need a yes from the user. */
const PROTECTED_WRITE = [/^\.claude\//, /^\.agents\//, /^\.github\//, /^tools\//, /^salary_lookup\.py$/, /^ui\//];

export const SUMMARY_MAX = 600;
export function trimSummary(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > SUMMARY_MAX ? t.slice(0, SUMMARY_MAX - 1).trimEnd() + "…" : t;
}

export function mapQuestions(raw: unknown): AskQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is Record<string, unknown> => !!q && typeof q === "object" && typeof (q as { question?: unknown }).question === "string")
    .map((q) => ({
      question: String(q.question),
      header: typeof q.header === "string" ? q.header : undefined,
      multiSelect: q.multiSelect === true ? true : undefined,
      options: Array.isArray(q.options)
        ? q.options
            .filter((o): o is Record<string, unknown> => !!o && typeof o === "object" && typeof (o as { label?: unknown }).label === "string")
            .map((o) => ({ label: String(o.label), description: typeof o.description === "string" ? o.description : undefined }))
        : [],
    }));
}

type Decision = { kind: "allow" } | { kind: "deny"; message: string } | { kind: "ask"; what: string; detail?: string };

export function classifyTool(repoRoot: string, toolName: string, input: Record<string, unknown>): Decision {
  if (SAFE_TOOLS.has(toolName)) return { kind: "allow" };
  if (WRITE_TOOLS.has(toolName)) {
    const p = writePath(toolName, input);
    const rel = p ? repoRelative(repoRoot, p) : null;
    if (!rel) return { kind: "deny", message: "Writing outside the job-search repository is not allowed from the Gazette." };
    if (PROTECTED_WRITE.some((re) => re.test(rel))) return { kind: "ask", what: `edit ${rel}` };
    return { kind: "allow" };
  }
  if (toolName === "Bash") {
    const cmd = typeof input.command === "string" ? input.command : "";
    const desc = typeof input.description === "string" && input.description.trim() ? input.description.trim() : "a shell command";
    return { kind: "ask", what: desc.slice(0, 120), detail: cmd ? `Command: ${redact(cmd).slice(0, 240)}` : undefined };
  }
  if (toolName.startsWith("mcp__")) return { kind: "ask", what: `the connected tool ${toolName.replace(/^mcp__/, "").slice(0, 80)}` };
  return { kind: "ask", what: `the ${toolName.slice(0, 60)} tool` };
}

export interface RunnerDeps {
  repoRoot: string;
  registry: RunRegistry;
  queryFn: () => Promise<QueryFn>;
}

export function makeCanUseTool(deps: RunnerDeps, state: RunState): CanUseTool {
  const { repoRoot, registry } = deps;
  return async (toolName, input): Promise<PermissionResult> => {
    if (toolName === "AskUserQuestion") {
      const questions = mapQuestions(input.questions);
      const answers = await registry.ask(state, questions);
      if (!answers) return { behavior: "deny", message: "The run was cancelled before the user answered.", interrupt: true };
      return { behavior: "allow", updatedInput: { ...input, answers } };
    }
    const d = classifyTool(repoRoot, toolName, input);
    if (d.kind === "allow") return { behavior: "allow", updatedInput: input };
    if (d.kind === "deny") return { behavior: "deny", message: d.message };
    const question = `Allow the assistant to run: ${d.what}?`;
    const answers = await registry.ask(state, [
      {
        question,
        header: "Permission",
        options: [
          { label: "Allow", description: d.detail ?? "Let it go ahead this once." },
          { label: "Deny", description: "Skip this step." },
        ],
      },
    ]);
    if (!answers) return { behavior: "deny", message: "The run was cancelled.", interrupt: true };
    const pick = (answers[question] ?? Object.values(answers)[0] ?? "").trim();
    if (pick === "Allow") return { behavior: "allow", updatedInput: input };
    return { behavior: "deny", message: "The user denied this action in the Gazette. Continue without it or ask a different way." };
  };
}

export async function runAgent(deps: RunnerDeps, state: RunState): Promise<void> {
  const { repoRoot, registry } = deps;
  const { run } = state;
  const prompt = `/${run.command}${run.args ? " " + run.args : ""}`;
  registry.setStatus(state, "running", { startedAt: new Date().toISOString() });

  let authFailed = false;
  let result: SdkLikeMessage | null = null;
  const streamedIds = new Set<string>();
  const writeIds = new Map<string, string>(); // tool_use id -> repo-relative path
  let currentMsgId: string | null = null;
  let logged = false;
  let needSep = false;

  const log = (text: string) => {
    if (!text) return;
    registry.emit(state, { type: "log", text: (needSep && logged ? "\n\n" : "") + text });
    needSep = false;
    logged = true;
  };

  try {
    const q = await deps.queryFn();
    if (registry.isFinal(state)) return;
    const options: Options = {
      cwd: repoRoot,
      settingSources: ["user", "project", "local"],
      permissionMode: "default",
      canUseTool: makeCanUseTool(deps, state),
      abortController: state.abort,
      includePartialMessages: true,
      systemPrompt: { type: "preset", preset: "claude_code", append: SYSTEM_APPEND },
    };
    const handle = q({ prompt, options });
    state.stop = () => {
      handle.interrupt?.().catch(() => {});
      handle.close?.();
    };

    for await (const m of handle) {
      if (registry.isFinal(state)) break;
      switch (m.type) {
        case "stream_event": {
          if (m.parent_tool_use_id) break;
          const ev = m.event ?? {};
          if (ev.type === "message_start" && ev.message?.id) {
            currentMsgId = ev.message.id;
            streamedIds.add(ev.message.id);
          } else if (ev.type === "content_block_start" && ev.content_block?.type === "text") {
            needSep = true;
          } else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            log(ev.delta.text ?? "");
          }
          break;
        }
        case "assistant": {
          if (m.error === "authentication_failed") authFailed = true;
          const msg = m.message ?? {};
          const content: SdkLikeMessage[] = Array.isArray(msg.content) ? msg.content : [];
          const streamed = !!msg.id && (streamedIds.has(msg.id) || msg.id === currentMsgId);
          for (const block of content) {
            if (block.type === "tool_use") {
              const input = (block.input ?? {}) as Record<string, unknown>;
              const line = progressFor(String(block.name), input);
              if (line) registry.progress(state, line);
              const p = writePath(String(block.name), input);
              const rel = p ? repoRelative(repoRoot, p) : null;
              if (rel && block.id) writeIds.set(String(block.id), rel);
            } else if (block.type === "text" && !m.parent_tool_use_id && !streamed) {
              needSep = true;
              log(String(block.text ?? ""));
            }
          }
          break;
        }
        case "user": {
          const content = m.message?.content;
          if (!Array.isArray(content)) break;
          const done: string[] = [];
          for (const b of content) {
            if (b?.type === "tool_result" && writeIds.has(b.tool_use_id) && !b.is_error) done.push(writeIds.get(b.tool_use_id)!);
          }
          if (done.length) registry.addFiles(state, done);
          break;
        }
        case "auth_status":
          if (m.error && looksLikeAuthError(String(m.error))) authFailed = true;
          break;
        case "result":
          result = m;
          break;
      }
    }
  } catch (err) {
    if (registry.isFinal(state)) return;
    if (state.abort.signal.aborted) return registry.finish(state, "cancelled");
    const text = err instanceof Error ? err.message : String(err);
    if (authFailed || looksLikeAuthError(text)) return registry.finish(state, "failed", { error: authErrorMessage(repoRoot) });
    return registry.finish(state, "failed", { error: text.slice(0, SUMMARY_MAX) || "The assistant stopped unexpectedly." });
  } finally {
    state.stop = null;
  }

  if (registry.isFinal(state)) return;
  if (state.abort.signal.aborted) return registry.finish(state, "cancelled");
  if (!result) {
    if (authFailed) return registry.finish(state, "failed", { error: authErrorMessage(repoRoot) });
    return registry.finish(state, "failed", { error: "The assistant stopped without reporting a result." });
  }
  const r = result;
  const resultText = typeof r.result === "string" ? r.result : "";
  const errors = Array.isArray(r.errors) ? r.errors.join("; ") : "";
  if (r.subtype === "success" && !r.is_error) {
    return registry.finish(state, "done", { summary: trimSummary(resultText) });
  }
  if (authFailed || looksLikeAuthError(resultText) || looksLikeAuthError(errors)) {
    return registry.finish(state, "failed", { error: authErrorMessage(repoRoot) });
  }
  const why =
    r.subtype === "error_max_turns" ? "The assistant hit its turn limit before finishing." :
    r.subtype === "error_max_budget_usd" ? "The run hit its budget limit before finishing." :
    errors || resultText || "The assistant reported an error.";
  return registry.finish(state, "failed", { error: why.trim().slice(0, SUMMARY_MAX), summary: trimSummary(r.subtype === "success" ? null : resultText) });
}
