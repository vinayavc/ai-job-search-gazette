// The Sausage Gazette - shared contract between server and web.
// Every builder imports from here. Change it only through the orchestrator.
//
// Data sources are the upstream ai-job-search files ONLY:
//   job_scraper/seen_jobs.json (or .claude/skills/job-scraper/job_scraper/seen_jobs.json)
//   job_search_tracker.csv
//   cv/, cover_letters/, documents/applications/<company>_<role>/
//   CLAUDE.md (candidate name)
// Never read LATEST_SCRAPE.md, APPLY_LINKS.md, job_scraper/scrapes/ or tools/scrape_report.py.

export type JobStatus = "new" | "ranked" | "skipped" | "expired" | "unreachable" | (string & {});
export type Gate = "PASS" | "FAIL" | "FLAG";

export interface Job {
  key: string;                // key in seen_jobs.json "seen" map
  title: string;
  company: string;
  url: string;
  location: string | null;
  portal: string | null;
  firstSeen: string | null;   // YYYY-MM-DD
  postedDate: string | null;
  deadline: string | null;
  scrapeFit: "low" | "medium" | "high" | null; // scraper's quick "fit"
  status: JobStatus;
  rankScore: number | null;   // 0-100
  rankVerdict: string | null; // "Strong Fit" | "Good Fit" | "Moderate Fit" | "Weak Fit" | "Poor Fit"
  rankDate: string | null;
  locationVerdict: Gate | null;
  languageGate: Gate | null;
  languageNote: string | null;
  strengths: string[];
  gaps: string[];
  guard: string | null;       // "clean" or a posting_guard warning line
  applicants: number | string | null;
  // Derived by the server:
  vetoed: boolean;            // locationVerdict === "FAIL" || languageGate === "FAIL"
  flagged: boolean;           // any FLAG gate, or guard present and !== "clean"
  isFresh: boolean;           // firstSeen === newest firstSeen across all jobs
  application: Application | null; // matched tracker row, if any
}

export type TrackerStatus =
  | "drafted" | "applied" | "interview" | "offer" | "hired"
  | "rejected" | "no_response" | "offer_declined" | "withdrawn" | (string & {});

export interface Application {
  rowIndex: number;           // 0-based data row in job_search_tracker.csv
  date: string;
  company: string;
  sector: string;
  role: string;
  roleType: string;
  channel: string;
  status: TrackerStatus;
  isFinal: boolean;           // hired|rejected|no_response|offer_declined|withdrawn (+ legacy spaced spellings)
  contactPerson: string;
  fitRating: string;
  notes: string;
  cvFile: string;             // repo-relative, as written by /apply
  coverLetterFile: string;
  source: string;             // posting URL
  deadline: string;
  docs: ApplicationDocs;
  jobKey: string | null;      // matched seen_jobs key, if any
}

export interface ApplicationDocs {
  cvPdf: string | null;           // repo-relative path, only if file exists
  coverLetterPdf: string | null;
  folder: string | null;          // documents/applications/<company>_<role> if it exists
  interviewPrep: string[];        // repo-relative .md files in folder
  outcome: string | null;         // folder/outcome.md if present
}

export interface Profile {
  name: string | null;        // from CLAUDE.md "**Name:**" line; null if template/unset
  hasProfile: boolean;        // false -> show "Subscribe to the Gazette" (/setup)
}

export interface Edition {
  generatedAt: string;        // ISO
  profile: Profile;
  jobs: Job[];                // all jobs; web decides what to print
  applications: Application[];
  editionNumber: number;      // count of distinct firstSeen dates
}

export interface UiState {
  circled: string[];          // job keys
  autoRank: boolean;          // run /rank after every /scrape (default true)
  dogName: string;            // what the dachshund is called in the UI (default "Doxie"), 1-24 characters
  circlesOpen: boolean;       // "Your circles" expanded in the sidebar (default true)
  tourSeen: boolean;          // the first-run tour was finished or skipped (default false: it opens on first visit)
  stations: LiveStation[];    // live stations added from the radio's "Add a station" (stations.json ones are separate)
  radio: { station: RadioStation; volume: number; on: boolean };
}

// The built-in stations, or "live:<id>" for a live stream listed in public/records/stations.json (local, gitignored).
export type RadioStation = "jazz" | "lofi" | "rain" | `live:${string}`;
export interface LiveStation {
  id: string;                 // lowercase letters, digits and dashes, up to 40
  name: string;               // what the dial shows, e.g. "WAVE 98.3"
  url: string;                // an http(s) audio stream (Icecast/Shoutcast MP3 or AAC)
  cors?: boolean;             // false: the stream refuses cross-origin playback, so it plays without Web Audio
}

// ---------- Agent runs ----------

export type Command =
  | "setup" | "scrape" | "rank" | "apply" | "outcome"
  | "gmail-sync" | "interview" | "upskill";

export type RunStatus = "queued" | "running" | "waiting_input" | "done" | "failed" | "cancelled";

export interface RunRequest {
  command: Command;
  args?: string;              // e.g. posting URL for apply, "<company> applied" for outcome
}

export interface Run {
  id: string;
  command: Command;
  args: string;
  status: RunStatus;
  startedAt: string | null;
  endedAt: string | null;
  summary: string | null;     // final assistant text, trimmed
  error: string | null;
}

export interface AskOption { label: string; description?: string }
export interface AskQuestion {
  question: string;
  header?: string;
  options: AskOption[];       // may be empty -> free text answer
  multiSelect?: boolean;
}

export type RunEvent =
  | { type: "status"; run: Run }
  | { type: "progress"; text: string }             // short ticker line ("Checking LinkedIn...")
  | { type: "log"; text: string }                  // assistant prose, streamed
  | { type: "question"; questionId: string; questions: AskQuestion[] }
  | { type: "files"; paths: string[] }             // repo-relative files written this run
  | { type: "done"; run: Run };

export interface AnswerRequest {
  questionId: string;
  answers: Record<string, string>; // question text -> chosen label(s) joined by ", " or free text
}

export interface MarkSentRequest { jobKey: string }

// POST /api/radio/find: turn a station's link (its stream, a .pls/.m3u playlist, or its "listen live" web page)
// into a playable stream. 422 with { error } when no stream is found.
export interface FindStationRequest { url: string }
export interface FoundStation { name: string; url: string; cors: boolean }
