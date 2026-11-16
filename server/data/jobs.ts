import { join } from "node:path";
import type { Gate, Job } from "../../contract/types";
import { readText } from "./util";

const GATES = new Set(["PASS", "FAIL", "FLAG"]);
const FITS = new Set(["low", "medium", "high"]);

type Entry = Record<string, unknown>;

// Last good parse per path: seen_jobs.json is rewritten while agents run, and a
// half-written file must not blank the paper.
const lastGood = new Map<string, Record<string, Entry>>();

export function seenJobsPath(repoRoot: string): string | null {
  for (const rel of ["job_scraper/seen_jobs.json", ".claude/skills/job-scraper/job_scraper/seen_jobs.json"]) {
    const p = join(repoRoot, rel);
    if (readText(p) !== null) return p;
  }
  return null;
}

export function loadSeen(repoRoot: string): Record<string, Entry> {
  const path = seenJobsPath(repoRoot);
  if (!path) return {};
  const text = readText(path);
  if (text === null) return lastGood.get(path) ?? {};
  try {
    const doc = JSON.parse(text) as unknown;
    // Same shape rule as rank_state.load_state: {"seen": {...}} or a bare map.
    const seen = doc && typeof doc === "object" && !Array.isArray(doc) && "seen" in (doc as object)
      ? (doc as { seen: unknown }).seen
      : doc;
    if (!seen || typeof seen !== "object" || Array.isArray(seen)) throw new Error("bad shape");
    const map: Record<string, Entry> = {};
    for (const [k, v] of Object.entries(seen as Record<string, unknown>)) {
      if (v && typeof v === "object" && !Array.isArray(v)) map[k] = v as Entry;
    }
    lastGood.set(path, map);
    return map;
  } catch {
    return lastGood.get(path) ?? {};
  }
}

const str = (v: unknown): string | null =>
  typeof v === "string" ? (v.trim() === "" ? null : v) : typeof v === "number" ? String(v) : null;

const gate = (v: unknown): Gate | null => (typeof v === "string" && GATES.has(v.trim().toUpperCase()) ? (v.trim().toUpperCase() as Gate) : null);

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => x != null).map((x) => String(x)) : []);

const dateOnly = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
};

/** Map one seen_jobs.json entry to Job (application/isFresh filled in later). */
export function mapJob(key: string, e: Entry): Job {
  const rawLocation = str(e.location);
  const legacyVerdict = gate(rawLocation);
  const locationVerdict = gate(e.location_verdict) ?? legacyVerdict;
  const languageGate = gate(e.language_gate);
  const guard = str(e.guard);
  const score = typeof e.rank_score === "number" ? e.rank_score : typeof e.rank_score === "string" && e.rank_score.trim() !== "" && !isNaN(Number(e.rank_score)) ? Number(e.rank_score) : null;
  const fit = typeof e.fit === "string" ? e.fit.trim().toLowerCase() : "";
  const applicants = typeof e.applicants === "number" || typeof e.applicants === "string" ? e.applicants : null;
  return {
    key,
    title: str(e.title) ?? "",
    company: str(e.company) ?? "",
    url: str(e.url) ?? "",
    location: legacyVerdict ? null : rawLocation,
    portal: str(e.portal),
    firstSeen: dateOnly(e.first_seen),
    postedDate: str(e.posted_date),
    deadline: str(e.deadline),
    scrapeFit: FITS.has(fit) ? (fit as Job["scrapeFit"]) : null,
    status: str(e.status) ?? "new",
    rankScore: score,
    rankVerdict: str(e.rank_verdict),
    rankDate: str(e.rank_date),
    locationVerdict,
    languageGate,
    languageNote: str(e.language_note),
    strengths: list(e.strengths),
    gaps: list(e.gaps),
    guard,
    applicants,
    vetoed: locationVerdict === "FAIL" || languageGate === "FAIL",
    flagged: locationVerdict === "FLAG" || languageGate === "FLAG" || (guard !== null && guard !== "clean"),
    isFresh: false,
    application: null,
  };
}

export function loadJobs(repoRoot: string): Job[] {
  const seen = loadSeen(repoRoot);
  const jobs = Object.entries(seen).map(([k, e]) => mapJob(k, e));
  let newest: string | null = null;
  for (const j of jobs) if (j.firstSeen && (newest === null || j.firstSeen > newest)) newest = j.firstSeen;
  for (const j of jobs) j.isFresh = newest !== null && j.firstSeen === newest;
  return jobs;
}
