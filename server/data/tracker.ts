import { readdirSync } from "node:fs";
import { join, isAbsolute, normalize, sep } from "node:path";
import type { Application, ApplicationDocs } from "../../contract/types";
import { parseCsv, type CsvField, type CsvRecord } from "./csv";
import { folderName, isDir, isFile, norm, readText } from "./util";

export const TRACKER_FILE = "job_search_tracker.csv";
export const HEADER = [
  "date", "company", "sector", "role", "role_type", "channel", "status",
  "contact_person", "fit_rating", "notes", "cv_file", "cover_letter_file", "source", "deadline",
] as const;

const FINAL = new Set(["hired", "rejected", "no_response", "offer_declined", "withdrawn", "no response", "offer declined"]);

export function isFinalStatus(status: string): boolean {
  return FINAL.has(status.trim().toLowerCase());
}

export interface TrackerRow {
  rowIndex: number;
  record: CsvRecord;
  /** column name -> field (notes may be a synthetic span over overflow fields) */
  cells: Map<string, CsvField>;
  get(col: string): string;
}

export interface TrackerFile {
  text: string;
  header: string[];
  headerRecord: CsvRecord | null;
  rows: TrackerRow[];
}

export function trackerPath(repoRoot: string): string {
  return join(repoRoot, TRACKER_FILE);
}

/** Parse the tracker. Rows with more fields than the header (an unquoted comma in
 *  free text) have their overflow folded into `notes`, the only free-text column,
 *  so later columns (cv_file, source...) stay aligned. */
export function parseTracker(text: string): TrackerFile {
  const records = parseCsv(text);
  if (records.length === 0) return { text, header: [...HEADER], headerRecord: null, rows: [] };
  const headerRecord = records[0];
  const header = headerRecord.fields.map((f) => f.value.trim().toLowerCase());
  const notesIdx = header.indexOf("notes");
  const rows: TrackerRow[] = records.slice(1).map((record, rowIndex) => {
    let fields = record.fields;
    const extra = fields.length - header.length;
    if (extra > 0 && notesIdx >= 0) {
      const span = fields.slice(notesIdx, notesIdx + extra + 1);
      const merged: CsvField = {
        value: span.map((f) => f.value).join(","),
        start: span[0].start,
        end: span[span.length - 1].end,
        quoted: false,
      };
      fields = [...fields.slice(0, notesIdx), merged, ...fields.slice(notesIdx + extra + 1)];
    }
    const cells = new Map<string, CsvField>();
    header.forEach((h, i) => { if (fields[i] && !cells.has(h)) cells.set(h, fields[i]); });
    return { rowIndex, record, cells, get: (c: string) => cells.get(c)?.value ?? "" };
  });
  return { text, header, headerRecord, rows };
}

export function loadTracker(repoRoot: string): TrackerFile | null {
  const text = readText(trackerPath(repoRoot));
  return text === null ? null : parseTracker(text);
}

/** A repo-relative path that stays inside the repo, or null. */
function safeRel(rel: string): string | null {
  const r = rel.trim().replace(/\\/g, "/");
  if (!r || isAbsolute(r) || /^[a-zA-Z]:/.test(r)) return null;
  const n = normalize(r);
  if (n.split(sep).includes("..") || n.split("/").includes("..")) return null;
  return n.split(sep).join("/");
}

function pdfOf(repoRoot: string, rel: string): string | null {
  const r = safeRel(rel);
  if (!r) return null;
  const pdf = /\.[^./]+$/.test(r) ? r.replace(/\.[^./]+$/, ".pdf") : r + ".pdf";
  return isFile(join(repoRoot, pdf)) ? pdf : null;
}

export function findFolder(repoRoot: string, company: string, role: string): string | null {
  const base = join(repoRoot, "documents", "applications");
  if (!isDir(base)) return null;
  const name = folderName(company, role);
  if (name && isDir(join(base, name))) return `documents/applications/${name}`;
  const target = norm(company) + norm(role);
  if (!target) return null;
  try {
    for (const d of readdirSync(base).sort()) {
      if (norm(d) === target && isDir(join(base, d))) return `documents/applications/${d}`;
    }
  } catch { /* unreadable */ }
  return null;
}

export function applicationDocs(repoRoot: string, company: string, role: string, cvFile: string, clFile: string): ApplicationDocs {
  const folder = findFolder(repoRoot, company, role);
  let interviewPrep: string[] = [];
  let outcome: string | null = null;
  if (folder) {
    try {
      const names = readdirSync(join(repoRoot, folder)).sort();
      interviewPrep = names
        .filter((f) => f.toLowerCase().endsWith(".md") && f.toLowerCase() !== "outcome.md" && isFile(join(repoRoot, folder, f)))
        .map((f) => `${folder}/${f}`);
      const o = names.find((f) => f.toLowerCase() === "outcome.md");
      if (o && isFile(join(repoRoot, folder, o))) outcome = `${folder}/${o}`;
    } catch { /* unreadable */ }
  }
  return { cvPdf: cvFile ? pdfOf(repoRoot, cvFile) : null, coverLetterPdf: clFile ? pdfOf(repoRoot, clFile) : null, folder, interviewPrep, outcome };
}

export function toApplication(repoRoot: string, row: TrackerRow): Application {
  const g = row.get;
  const status = g("status").trim();
  return {
    rowIndex: row.rowIndex,
    date: g("date"),
    company: g("company"),
    sector: g("sector"),
    role: g("role"),
    roleType: g("role_type"),
    channel: g("channel"),
    status,
    isFinal: isFinalStatus(status),
    contactPerson: g("contact_person"),
    fitRating: g("fit_rating"),
    notes: g("notes"),
    cvFile: g("cv_file"),
    coverLetterFile: g("cover_letter_file"),
    source: g("source"),
    deadline: g("deadline"),
    docs: applicationDocs(repoRoot, g("company"), g("role"), g("cv_file"), g("cover_letter_file")),
    jobKey: null,
  };
}

export function loadApplications(repoRoot: string): Application[] {
  const t = loadTracker(repoRoot);
  return t ? t.rows.map((r) => toApplication(repoRoot, r)) : [];
}
