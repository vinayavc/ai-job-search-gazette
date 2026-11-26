// Orchestrator-owned: route wiring only. Logic lives in ./data and ./agent.
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { dataRoutes } from "./data";
import { agentRoutes } from "./agent";
import { radioRoutes } from "./radio";

export type RouteHandler = (req: Request, params: Record<string, string>) => Response | Promise<Response>;

// The Gazette is a layer on top of an ai-job-search checkout. Point it at one with
// GAZETTE_JOB_REPO, or clone the Gazette inside that checkout (default: parent folder).
const looksLikeJobRepo = (dir: string) => existsSync(join(dir, ".claude", "commands", "rank.md"));
const candidates = [process.env.GAZETTE_JOB_REPO, resolve(import.meta.dir, "..", ".."), resolve(import.meta.dir, "..", "..", "ai-job-search")]
  .filter((d): d is string => Boolean(d)).map((d) => resolve(d));
const repoRoot = candidates.find(looksLikeJobRepo);
if (!repoRoot) {
  console.error("Can't find your ai-job-search folder. Set GAZETTE_JOB_REPO=/path/to/ai-job-search, or clone the Gazette inside it.");
  process.exit(1);
}
const routes: Record<string, RouteHandler> = { ...dataRoutes(repoRoot), ...agentRoutes(repoRoot), ...radioRoutes() };

const compiled = Object.entries(routes).map(([key, handler]) => {
  const [method, path] = key.split(" ");
  const names: string[] = [];
  const re = new RegExp("^" + path.replace(/:([a-zA-Z]+)/g, (_, n) => (names.push(n), "([^/]+)")) + "$");
  return { method, re, names, handler };
});

const port = Number(process.env.GAZETTE_PORT ?? 4747);
const staticDir = join(import.meta.dir, "..", "dist");

Bun.serve({
  port,
  hostname: "127.0.0.1",
  idleTimeout: 0, // SSE streams stay open
  async fetch(req) {
    const url = new URL(req.url);
    for (const r of compiled) {
      if (r.method !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      try {
        return await r.handler(req, params);
      } catch (err) {
        console.error(err);
        return Response.json({ error: String((err as Error).message ?? err) }, { status: 500 });
      }
    }
    if (url.pathname.startsWith("/api/")) return Response.json({ error: "not found" }, { status: 404 });
    if (process.env.GAZETTE_STATIC) {
      const file = Bun.file(join(staticDir, url.pathname === "/" ? "index.html" : url.pathname));
      return (await file.exists()) ? new Response(file) : new Response(Bun.file(join(staticDir, "index.html")));
    }
    return new Response("Run the web app with `bun run dev` and open the Vite URL.", { status: 404 });
  },
});
console.log(`Sausage Gazette server on http://127.0.0.1:${port} (repo: ${repoRoot})`);
