// Desk editor: read-side data routes for The Sausage Gazette.
import type { RouteHandler } from "../index";
import { buildEdition } from "./edition";
import { checkFilePath } from "./files";
import { markSent } from "./markSent";
import { loadState, mergeState, saveState, StateError } from "./state";
import { error, json } from "./util";

export { buildEdition } from "./edition";

export interface DataOptions {
  /** Clock override for tests. */
  now?: () => Date;
}

export function dataRoutes(repoRoot: string, opts: DataOptions = {}): Record<string, RouteHandler> {
  const now = opts.now ?? (() => new Date());

  const readBody = async (req: Request): Promise<unknown> => {
    try { return await req.json(); } catch { return undefined; }
  };

  return {
    "GET /api/edition": () => json(buildEdition(repoRoot, now())),

    "GET /api/jobs/:key": (_req, params) => {
      const job = buildEdition(repoRoot, now()).jobs.find((j) => j.key === params.key);
      return job ? json(job) : error(`unknown job ${params.key}`, 404);
    },

    "GET /api/state": () => json(loadState(repoRoot)),

    "PUT /api/state": async (req) => {
      const body = await readBody(req);
      try {
        const next = mergeState(loadState(repoRoot), body);
        saveState(repoRoot, next);
        return json(next);
      } catch (err) {
        if (err instanceof StateError) return error(err.message, 400);
        throw err;
      }
    },

    "POST /api/applications/mark-sent": async (req) => {
      const body = (await readBody(req)) as { jobKey?: unknown } | undefined;
      if (!body || typeof body.jobKey !== "string" || !body.jobKey) return error("jobKey (string) is required", 400);
      const r = markSent(repoRoot, body.jobKey, now());
      return json(r.body, r.status);
    },

    "GET /api/files": (req) => {
      const rel = new URL(req.url).searchParams.get("path");
      const check = checkFilePath(repoRoot, rel);
      if (!check.ok) return error(check.error, check.status);
      return new Response(Bun.file(check.abs), { headers: { "content-type": check.contentType, "cache-control": "no-store" } });
    },
  };
}
