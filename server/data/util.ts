import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

/** Same as tools/rank_state.py norm(): casefold, keep letters/digits/combining marks. */
export function norm(text: unknown): string {
  const s = String(text ?? "").toLowerCase().normalize("NFC");
  let out = "";
  for (const ch of s) if (/[\p{L}\p{N}\p{M}]/u.test(ch)) out += ch;
  return out;
}

/** Posting URL identity: drop fragment, query string and trailing slashes; lowercase scheme+host. */
export function normUrl(url: unknown): string {
  let s = String(url ?? "").trim();
  if (!s) return "";
  s = s.split("#")[0].split("?")[0];
  s = s.replace(/\/+$/, "");
  const m = s.match(/^([a-z][a-z0-9+.-]*:\/\/)([^/]*)(.*)$/i);
  if (m) s = m[1].toLowerCase() + m[2].toLowerCase() + m[3];
  return s;
}

/** documents/README.md "Subfolder naming": <company>_<role>, lowercase, underscores. */
export function folderName(company: string, role: string): string {
  const raw = `${company}_${role}`.toLowerCase().replace(/\s+/g, "_");
  let out = "";
  for (const ch of raw) if (/[\p{L}\p{N}_]/u.test(ch)) out += ch;
  return out.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

export function today(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function isFile(path: string): boolean {
  try { return statSync(path).isFile(); } catch { return false; }
}

export function isDir(path: string): boolean {
  try { return statSync(path).isDirectory(); } catch { return false; }
}

/** Write via a temp file in the same directory, then rename over the target. */
export function atomicWrite(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${Date.now()}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
  try {
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* already gone */ }
    throw err;
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
