import { realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const ALLOWED_DIRS = ["cv/", "cover_letters/", "documents/applications/"];

export const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
  tex: "text/x-tex; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

export type FileCheck =
  | { ok: true; abs: string; contentType: string }
  | { ok: false; status: number; error: string };

/** Validate a repo-relative path for GET /api/files. */
export function checkFilePath(repoRoot: string, rel: string | null): FileCheck {
  if (!rel) return { ok: false, status: 400, error: "path is required" };
  if (rel.includes("\0") || rel.includes("\\")) return { ok: false, status: 400, error: "invalid path" };
  if (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel) || rel.startsWith("~")) return { ok: false, status: 400, error: "absolute paths are not allowed" };
  const parts = rel.split("/");
  if (parts.some((p) => p === ".." || p === ".")) return { ok: false, status: 400, error: "relative segments are not allowed" };
  if (parts.some((p) => p === "")) return { ok: false, status: 400, error: "invalid path" };
  if (!ALLOWED_DIRS.some((d) => rel.startsWith(d))) return { ok: false, status: 403, error: "only cv/, cover_letters/ and documents/applications/ are served" };
  const ext = (rel.match(/\.([^./]+)$/)?.[1] ?? "").toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return { ok: false, status: 415, error: "only pdf, md, tex and txt files are served" };
  const abs = join(repoRoot, ...parts);
  let real: string;
  let realRoot: string;
  try {
    real = realpathSync(abs);
    realRoot = realpathSync(repoRoot);
  } catch {
    return { ok: false, status: 404, error: "not found" };
  }
  if (!real.startsWith(realRoot + sep)) return { ok: false, status: 403, error: "path escapes the repository" };
  try {
    if (!statSync(real).isFile()) return { ok: false, status: 404, error: "not found" };
  } catch {
    return { ok: false, status: 404, error: "not found" };
  }
  return { ok: true, abs: real, contentType };
}
