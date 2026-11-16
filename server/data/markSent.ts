import type { Application } from "../../contract/types";
import { applySplices, formatField, type Splice } from "./csv";
import { matchApplications } from "./edition";
import { loadJobs } from "./jobs";
import { HEADER, parseTracker, toApplication, trackerPath, type TrackerFile } from "./tracker";
import { atomicWrite, readText, today } from "./util";

export type MarkSentResult = { status: 200; body: Application } | { status: 404 | 400; body: { error: string } };

/** outcome.md Step 4: notes carry no commas, double quotes or line breaks. */
export function sanitizeNote(s: string): string {
  return s.replace(/[\r\n]+/g, " ").replace(/,/g, " -").replace(/"/g, "'").replace(/\s{2,}/g, " ").trim();
}

function detectEol(t: TrackerFile): string {
  const withEol = [t.headerRecord, ...t.rows.map((r) => r.record)].find((r) => r && r.eol);
  return withEol?.eol || "\n";
}

function finish(repoRoot: string, jobKey: string, rowIndex: number): Application {
  const t = parseTracker(readText(trackerPath(repoRoot)) ?? "");
  const app = toApplication(repoRoot, t.rows[rowIndex]);
  app.jobKey = jobKey;
  return app;
}

export function markSent(repoRoot: string, jobKey: string, now: Date = new Date()): MarkSentResult {
  const jobs = loadJobs(repoRoot);
  const job = jobs.find((j) => j.key === jobKey);
  if (!job) return { status: 404, body: { error: `unknown job ${jobKey}` } };

  const path = trackerPath(repoRoot);
  const text = readText(path);
  const day = today(now);
  const note = sanitizeNote(`marked sent via Sausage Gazette ${day}`);

  if (text !== null && text.replace(/^﻿/, "").trim() !== "") {
    const t = parseTracker(text);
    const apps = t.rows.map((r) => toApplication(repoRoot, r));
    matchApplications(jobs, apps);
    const app = job.application;
    if (app) {
      const status = app.status.trim().toLowerCase();
      if (status !== "drafted" && status !== "") return { status: 200, body: app }; // already sent or later
      const row = t.rows[app.rowIndex];
      const statusIdx = t.header.indexOf("status");
      const notesIdx = t.header.indexOf("notes");
      const dateIdx = t.header.indexOf("date");
      const notesCell = row.cells.get("notes");
      const oldNotes = notesCell?.value ?? "";
      const sepr = oldNotes.trim() ? "; " : "";
      const allPresent = statusIdx >= 0 && notesIdx >= 0 && dateIdx >= 0 && row.cells.has("status") && row.cells.has("notes") && row.cells.has("date");
      let next: string;
      if (allPresent) {
        const splices: Splice[] = [{ ...span(row.cells.get("status")!), text: "applied" }];
        const nc = notesCell!;
        splices.push({
          ...span(nc),
          text: nc.quoted ? formatField(oldNotes + sepr + note) : text.slice(nc.start, nc.end) + sepr + note,
        });
        if (status === "drafted") splices.push({ ...span(row.cells.get("date")!), text: day });
        next = applySplices(text, splices);
      } else {
        // Short row (missing trailing columns): rebuild it from its raw fields, padded.
        const raws = row.record.fields.map((f) => text.slice(f.start, f.end));
        while (raws.length < t.header.length) raws.push("");
        if (statusIdx >= 0) raws[statusIdx] = "applied";
        if (notesIdx >= 0) raws[notesIdx] = formatField(oldNotes + sepr + note);
        if (dateIdx >= 0 && status === "drafted") raws[dateIdx] = day;
        next = applySplices(text, [{ start: row.record.start, end: row.record.end, text: raws.join(",") }]);
      }
      atomicWrite(path, next);
      return { status: 200, body: finish(repoRoot, jobKey, app.rowIndex) };
    }
    // No matching row: append one.
    const eol = detectEol(t);
    const values: Record<string, string> = { date: day, company: job.company, role: job.title, status: "applied", source: job.url };
    const line = t.header.map((h) => formatField(values[h] ?? "")).join(",");
    const endsWithEol = /[\r\n]$/.test(text);
    atomicWrite(path, text + (endsWithEol ? "" : eol) + line + (endsWithEol ? eol : ""));
    return { status: 200, body: finish(repoRoot, jobKey, t.rows.length) };
  }

  // No tracker yet (or an empty one): create it with the header.
  const values: Record<string, string> = { date: day, company: job.company, role: job.title, status: "applied", source: job.url };
  const line = HEADER.map((h) => formatField(values[h] ?? "")).join(",");
  atomicWrite(path, HEADER.join(",") + "\n" + line + "\n");
  return { status: 200, body: finish(repoRoot, jobKey, 0) };
}

function span(f: { start: number; end: number }) {
  return { start: f.start, end: f.end };
}
