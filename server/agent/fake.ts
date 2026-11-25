// GAZETTE_FAKE_AGENT=1: a scripted stand-in for the SDK's query(). It yields
// SDK-shaped messages and calls canUseTool for AskUserQuestion, so fake runs go
// through exactly the same pipeline as real ones. Nothing is written to disk.
// GAZETTE_FAKE_AGENT=auth plays a "not signed in" failure instead.
import { join } from "node:path";
import type { Command } from "../../contract/types";
import type { QueryFn, SdkLikeMessage } from "./runner";

type Step =
  | { tool: string; input: Record<string, unknown> }
  | { say: string }
  | { ask: { question: string; header: string; options: { label: string; description: string }[]; multiSelect?: boolean }; stopIf?: string; stopSay?: string }
  | { write: string };

const P = (cmd: string) => ({ tool: "Bash", input: { command: cmd, description: "scripted" } });

function script(command: Command, args: string): { steps: Step[]; summary: string } {
  switch (command) {
    case "scrape":
      return {
        steps: [
          { say: "Good morning! Heading out to collect today's postings." },
          { tool: "Skill", input: { skill: "scrape" } },
          { tool: "Read", input: { file_path: "CLAUDE.md" } },
          {
            ask: {
              question: "Include fully remote roles in today's search?",
              header: "Remote",
              options: [
                { label: "Yes, include remote", description: "Your city plus remote roles anywhere in your country." },
                { label: "Local only", description: "Only on-site or hybrid roles near you." },
              ],
            },
          },
          P("bun run .agents/skills/linkedin-search/cli/src/cli.ts search --query 'software engineer'"),
          P("bun run .agents/skills/linkedin-search/cli/src/cli.ts detail 123"),
          P("python3 tools/job_key.py batch"),
          { tool: "WebFetch", input: { url: "https://www.example.com/careers/backend-engineer?ref=feed", prompt: "Extract the posting" } },
          P("python3 tools/scrape_state.py record"),
          { say: "Found 7 new postings; 2 were reposts and stay hidden." },
        ],
        summary: "Scrape complete: 7 new postings filed (3 high fit, 4 medium). 2 reposts hidden.",
      };
    case "rank":
      return {
        steps: [
          { say: "Pulling today's clippings for the ranking desk." },
          P("python3 tools/rank_state.py pending"),
          { tool: "Agent", input: { subagent_type: "posting-scorer", description: "Score batch 1", prompt: "..." } },
          { tool: "WebFetch", input: { url: "https://jobs.example.org/p/42" } },
          P("python3 tools/posting_guard.py check"),
          P("python3 tools/rank_state.py record"),
          { say: "Ranked 7 postings: 2 Strong Fit, 3 Good Fit, 2 Weak Fit." },
        ],
        summary: "Ranked 7 postings: 2 Strong Fit, 3 Good Fit, 2 Weak Fit.",
      };
    case "apply":
      return {
        steps: [
          { say: `Fetching the posting${args ? " you sent over" : ""} and checking fit first.` },
          { tool: "Agent", input: { subagent_type: "posting-fetcher", description: "Fetch posting", prompt: "..." } },
          { tool: "WebFetch", input: { url: args && /^https?:\/\//.test(args) ? args.split(/\s+/)[0] : "https://careers.example.com/jobs/1" } },
          { tool: "Read", input: { file_path: ".claude/skills/job-application-assistant/04-job-evaluation.md" } },
          { say: "Fit evaluation: Good Fit (78/100). Strong Java/AWS match; on-call is light per the posting." },
          {
            ask: {
              question: "Should I proceed with drafting the CV and cover letter for this role?",
              header: "Draft?",
              options: [
                { label: "Yes, draft them", description: "Write a tailored CV and cover letter." },
                { label: "No, stop here", description: "Keep the evaluation only." },
              ],
            },
            stopIf: "No, stop here",
            stopSay: "Understood, stopping after the evaluation.",
          },
          { write: "cv/Fake_Resume_Example_SDE.tex" },
          { write: "cover_letters/Fake_Cover_Letter_Example_SDE.tex" },
          P("lualatex -interaction=nonstopmode cv/Fake_Resume_Example_SDE.tex"),
          P("python3 tools/verify_pdf.py cv/Fake_Resume_Example_SDE.pdf"),
          { say: "Both documents compile to one page each and pass the checklist." },
        ],
        summary: "Drafted a tailored CV and cover letter (fake run). Review them, then submit the application yourself.",
      };
    default:
      return {
        steps: [
          { say: `Starting /${command}.` },
          { tool: "Read", input: { file_path: "job_search_tracker.csv" } },
          { tool: "Grep", input: { pattern: "x" } },
          { tool: "WebSearch", input: { query: "x" } },
          { tool: "TodoWrite", input: { todos: [] } },
          { say: `Finished /${command}.` },
        ],
        summary: `/${command} finished (fake run).`,
      };
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new Error("aborted"))), { once: true });
  });
}

let n = 0;
const id = (p: string) => `${p}_fake_${++n}`;

function* textMessages(text: string): Generator<SdkLikeMessage> {
  const mid = id("msg");
  yield { type: "stream_event", parent_tool_use_id: null, event: { type: "message_start", message: { id: mid } } };
  yield { type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } };
  for (const chunk of text.match(/.{1,18}(\s|$)|.+$/g) ?? [text]) {
    yield { type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: chunk } } };
  }
  yield { type: "assistant", parent_tool_use_id: null, message: { id: mid, content: [{ type: "text", text }] } };
}

export function makeFakeQuery(opts: { stepMs?: number; mode?: string } = {}): QueryFn {
  const stepMs = opts.stepMs ?? Number(process.env.GAZETTE_FAKE_STEP_MS ?? 1100);
  return ({ prompt, options }) => {
    const signal = options.abortController?.signal;
    const cwd = options.cwd ?? process.cwd();
    const m = prompt.match(/^\/(\S+)\s*(.*)$/);
    const command = (m?.[1] ?? "rank") as Command;
    const args = m?.[2] ?? "";

    async function* gen(): AsyncGenerator<SdkLikeMessage> {
      await sleep(stepMs / 2, signal);
      if ((opts.mode ?? process.env.GAZETTE_FAKE_AGENT) === "auth") {
        yield { type: "assistant", error: "authentication_failed", parent_tool_use_id: null, message: { id: id("msg"), content: [{ type: "text", text: "Invalid API key · Please run /login" }] } };
        yield { type: "result", subtype: "success", is_error: true, result: "Invalid API key · Please run /login" };
        return;
      }
      const { steps, summary } = script(command, args);
      for (const step of steps) {
        await sleep(stepMs, signal);
        if ("say" in step) {
          yield* textMessages(step.say);
        } else if ("tool" in step) {
          const tid = id("tool");
          yield { type: "assistant", parent_tool_use_id: null, message: { id: id("msg"), content: [{ type: "tool_use", id: tid, name: step.tool, input: step.input }] } };
          yield { type: "user", parent_tool_use_id: null, message: { content: [{ type: "tool_result", tool_use_id: tid, content: "ok" }] } };
        } else if ("write" in step) {
          const tid = id("tool");
          const input = { file_path: join(cwd, step.write), content: "% fake" };
          yield { type: "assistant", parent_tool_use_id: null, message: { id: id("msg"), content: [{ type: "tool_use", id: tid, name: "Write", input }] } };
          yield { type: "user", parent_tool_use_id: null, message: { content: [{ type: "tool_result", tool_use_id: tid, content: "File created successfully" }] } };
        } else if ("ask" in step) {
          const tid = id("tool");
          const input = { questions: [{ ...step.ask, multiSelect: step.ask.multiSelect ?? false }] };
          yield { type: "assistant", parent_tool_use_id: null, message: { id: id("msg"), content: [{ type: "tool_use", id: tid, name: "AskUserQuestion", input }] } };
          const res = await options.canUseTool!("AskUserQuestion", input, { signal: signal ?? new AbortController().signal, toolUseID: tid } as never);
          if (!res || res.behavior !== "allow") throw new Error("aborted");
          const answers = ((res.updatedInput as { answers?: Record<string, string> } | undefined)?.answers ?? {}) as Record<string, string>;
          yield { type: "user", parent_tool_use_id: null, message: { content: [{ type: "tool_result", tool_use_id: tid, content: JSON.stringify(answers) }] } };
          const picked = answers[step.ask.question];
          if (step.stopIf && picked === step.stopIf) {
            await sleep(stepMs / 2, signal);
            yield* textMessages(step.stopSay ?? "Stopping here.");
            yield { type: "result", subtype: "success", is_error: false, result: step.stopSay ?? "Stopped at your request." };
            return;
          }
        }
      }
      await sleep(stepMs / 2, signal);
      yield { type: "result", subtype: "success", is_error: false, result: summary };
    }

    const it = gen();
    return Object.assign(it, {
      interrupt: async () => {
        await it.return(undefined);
      },
      close: () => {
        void it.return(undefined);
      },
    });
  };
}
