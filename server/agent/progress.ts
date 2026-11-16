// Friendly ticker lines derived from tool use. Lines are built only from fixed
// phrases plus a hostname or a file basename, so commands, arguments, tokens
// and query strings never reach the UI.
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

const PORTAL_NAMES: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  workopolis: "Workopolis",
  jobbank: "Job Bank",
  "job-bank": "Job Bank",
  wellfound: "Wellfound",
  eluta: "Eluta",
};

function portalName(slug: string): string {
  const key = slug.toLowerCase();
  if (PORTAL_NAMES[key]) return PORTAL_NAMES[key];
  return key.split(/[-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || "a job board";
}

/** Strip leading `cd x &&`, env assignments and wrappers so we can see the real program. */
function mainCommand(cmd: string): string {
  let c = cmd.trim();
  c = c.replace(/^(cd\s+\S+\s*(&&|;)\s*)+/, "");
  c = c.replace(/^(\w+=\S*\s+)+/, "");
  return c;
}

const TOOL_SCRIPTS: Array<[RegExp, string]> = [
  [/tools\/rank_state\.py/, "Ranking desk is scoring postings"],
  [/tools\/scrape_state\.py/, "Filing today's clippings"],
  [/tools\/job_key\.py/, "Checking for repeat postings"],
  [/tools\/posting_guard\.py/, "Checking a posting for red flags"],
  [/tools\/fetch_page\.py/, "Reading a posting"],
  [/tools\/robots_check\.py/, "Checking a site's house rules"],
  [/tools\/verify_(pdf|layout)\.py/, "Proofreading the PDF"],
  [/salary_lookup\.py/, "Looking up salaries"],
  [/\b(lualatex|xelatex|pdflatex|latexmk)\b/, "Running the printing press"],
  [/\bpdftotext\b/, "Proofreading the PDF"],
];

export function bashProgress(command: string): string {
  const c = mainCommand(command);
  const portal = c.match(/\.agents\/skills\/([A-Za-z0-9_-]+?)(?:-search)?\/cli\b/) ?? c.match(/\.agents\/skills\/([A-Za-z0-9_-]+?)-search\b/);
  if (portal) return `Checking ${portalName(portal[1])}`;
  for (const [re, line] of TOOL_SCRIPTS) if (re.test(c)) return line;
  const prog = basename(c.split(/\s+/)[0] ?? "");
  if (prog === "git") return "Checking the archives";
  if (/^(ls|cat|head|tail|find|grep|rg|wc|sed|awk|stat|tree)$/.test(prog)) return "Leafing through the files";
  if (/^(python3?|bun|node|npx|bunx)$/.test(prog)) return "Running a desk calculation";
  return "Working at the desk";
}

function host(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function fileBase(p: unknown): string {
  return typeof p === "string" && p ? basename(p) : "a page";
}

/** Map one tool_use to a short ticker line, or null to stay quiet. */
export function progressFor(toolName: string, input: Record<string, unknown>): string | null {
  switch (toolName) {
    case "Bash":
      return typeof input.command === "string" ? bashProgress(input.command) : "Working at the desk";
    case "WebFetch": {
      const h = host(input.url);
      return h ? `Reading a posting at ${h}` : "Reading a posting";
    }
    case "WebSearch":
      return "Searching the wires";
    case "Task":
    case "Agent":
      return "Sending a reporter out";
    case "Write":
    case "Edit":
    case "MultiEdit":
      return `Typesetting ${fileBase(input.file_path)}`;
    case "NotebookEdit":
      return `Typesetting ${fileBase(input.notebook_path)}`;
    case "Read":
      return `Reading ${fileBase(input.file_path)}`;
    case "Glob":
    case "Grep":
      return "Leafing through the files";
    case "Skill": {
      const s = typeof input.skill === "string" ? input.skill.replace(/[^A-Za-z0-9 _:-]/g, "").slice(0, 40) : "";
      return s ? `Opening the ${s} playbook` : "Opening a playbook";
    }
    case "TodoWrite":
      return "Updating the assignment board";
    case "AskUserQuestion":
      return "Asking you a question";
  }
  if (toolName.startsWith("mcp__")) {
    return /gmail|mail/i.test(toolName) ? "Checking the mailbox" : /notion/i.test(toolName) ? "Updating Notion" : "Using a connected tool";
  }
  return null;
}

/** Absolute or relative tool path -> repo-relative posix path, or null if outside the repo. */
export function repoRelative(repoRoot: string, p: string): string | null {
  const abs = isAbsolute(p) ? resolve(p) : resolve(repoRoot, p);
  const rel = relative(repoRoot, abs);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel.split(sep).join("/");
}

export function isInside(repoRoot: string, p: string): boolean {
  return repoRelative(repoRoot, p) !== null;
}

export const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

export function writePath(toolName: string, input: Record<string, unknown>): string | null {
  if (!WRITE_TOOLS.has(toolName)) return null;
  const p = toolName === "NotebookEdit" ? input.notebook_path : input.file_path;
  return typeof p === "string" && p ? p : null;
}

/** Mask obvious secrets before showing a command to the user in a permission question. */
export function redact(s: string): string {
  return s
    .replace(/(authorization:\s*)(bearer\s+)?\S+/gi, "$1***")
    .replace(/\b(bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 ***")
    .replace(/((?:api[_-]?key|token|secret|password|passwd|pwd|auth)[A-Za-z_]*\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi, "$1***")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "sk-***");
}
