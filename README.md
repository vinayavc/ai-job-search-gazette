# The Sausage Gazette

A calm, newspaper-style layer on top of [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search). Sit in a 1950s diner, send the dachshund out for today's paper (`/scrape`), circle ads in the classifieds, read them, tailor a resume (`/apply`), and mark applications sent, all without opening a terminal.

See NOTES.md for design decisions, how the diorama is built, and open items.

It runs the repo's own commands through the Claude Agent SDK and reads only the repo's standard files (`job_scraper/seen_jobs.json`, `job_search_tracker.csv`, `cv/`, `cover_letters/`, `documents/applications/`, `CLAUDE.md`). UI-only state (your circles, radio settings) lives in `ui/.state/`, which git ignores.

## Install

Needs [Bun](https://bun.sh), a signed-in Claude Code, and a working ai-job-search checkout.

Clone the Gazette inside your ai-job-search folder (it finds the parent automatically), and keep it out of that repo's commits:

```bash
cd /path/to/ai-job-search
git clone https://github.com/vinayavc/ai-job-search-gazette.git ui
echo "/ui/" >> .git/info/exclude
cd ui && bun install && bun run dev
```

Or clone it anywhere and point it at your checkout:

```bash
GAZETTE_JOB_REPO=/path/to/ai-job-search bun run dev
```

Open http://localhost:5174.

If runs fail with a sign-in message, log the SDK's bundled Claude Code in (the exact command is shown on the order pad).

## Try it without spending tokens

```bash
GAZETTE_FAKE_AGENT=1 bun run dev
```

Every command plays a short scripted run, including a question on the order pad.

## Radio

Off until you press it. With no files it plays a soft tune generated in the browser. To stock it with your own royalty-free music, see `public/records/README.md`.

## Development

```bash
bun test          # server data + agent runner tests
bunx tsc --noEmit # typecheck
```

`contract/` holds the shared types and API between `server/` and `web/`.
