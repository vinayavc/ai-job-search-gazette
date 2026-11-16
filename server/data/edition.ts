import type { Application, Edition, Job } from "../../contract/types";
import { loadJobs } from "./jobs";
import { loadProfile } from "./profile";
import { loadApplications } from "./tracker";
import { norm, normUrl } from "./util";

/** Find the seen_jobs key for an application: URL identity first, then (company, title). */
export function matchApplications(jobs: Job[], apps: Application[]): void {
  const byUrl = new Map<string, Job>();
  const byPair = new Map<string, Job>();
  for (const j of jobs) {
    const u = normUrl(j.url);
    if (u && !byUrl.has(u)) byUrl.set(u, j);
    const c = norm(j.company);
    if (c) {
      const p = c + "\u0000" + norm(j.title);
      if (!byPair.has(p)) byPair.set(p, j);
    }
  }
  for (const a of apps) {
    const u = normUrl(a.source);
    let job = u ? byUrl.get(u) : undefined;
    if (!job && norm(a.company)) job = byPair.get(norm(a.company) + "\u0000" + norm(a.role));
    if (!job) continue;
    a.jobKey = job.key;
    // Several rows for one posting: the latest row wins.
    if (!job.application || job.application.rowIndex < a.rowIndex) job.application = a;
  }
}

export function buildEdition(repoRoot: string, now: Date = new Date()): Edition {
  const jobs = loadJobs(repoRoot);
  const applications = loadApplications(repoRoot);
  matchApplications(jobs, applications);
  const dates = new Set(jobs.map((j) => j.firstSeen).filter((d): d is string => !!d));
  return {
    generatedAt: now.toISOString(),
    profile: loadProfile(repoRoot),
    jobs,
    applications,
    editionNumber: dates.size,
  };
}
