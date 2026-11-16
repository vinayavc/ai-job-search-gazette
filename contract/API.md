# Sausage Gazette API contract

Server: Bun, port `4747` (env `GAZETTE_PORT`). Vite dev server proxies `/api` to it.
All bodies are JSON; types live in `contract/types.ts`. Errors: `{ "error": string }` with a 4xx/5xx status.

| Method | Path | Body / query | Returns | Owner |
|---|---|---|---|---|
| GET | `/api/edition` | - | `Edition` | data |
| GET | `/api/jobs/:key` | - | `Job` (404 if unknown) | data |
| GET | `/api/state` | - | `UiState` | data |
| PUT | `/api/state` | `Partial<UiState>` | `UiState` | data |
| POST | `/api/applications/mark-sent` | `MarkSentRequest` | `Application` | data |
| GET | `/api/files?path=<repo-relative>` | - | file bytes (pdf/md/tex), only under `cv/`, `cover_letters/`, `documents/applications/`; reject `..` and absolute paths | data |
| POST | `/api/runs` | `RunRequest` | `Run` (409 if a run is active) | agent |
| GET | `/api/runs/current` | - | `Run \| null` | agent |
| GET | `/api/runs/:id/events` | - | SSE stream of `RunEvent` (`data: <json>\n\n`); replays all past events of the run first | agent |
| POST | `/api/runs/:id/answer` | `AnswerRequest` | `{ ok: true }` | agent |
| POST | `/api/runs/:id/cancel` | - | `Run` | agent |

## Module boundaries (server)

`server/index.ts` (orchestrator-owned) only wires routes:

```ts
import { dataRoutes } from "./data";     // export function dataRoutes(repoRoot: string): Record<string, RouteHandler>
import { agentRoutes } from "./agent";   // export function agentRoutes(repoRoot: string): Record<string, RouteHandler>
```

where `type RouteHandler = (req: Request, params: Record<string,string>) => Response | Promise<Response>` and keys look like `"GET /api/edition"` or `"GET /api/jobs/:key"`.

## Rules every module must follow

- Repo root = parent of `ui/`. Resolve every path from it; never hard-code a user's name or path.
- Read only upstream files (see header of `types.ts`). UI-only state goes in `ui/.state/` (gitignored).
- `mark-sent` follows `.claude/commands/outcome.md`: touch only `status`, `notes` (and `date` when moving off `drafted`) of the matched row; notes contain no commas, quotes or line breaks; never reorder or restructure the CSV. If no row matches, append one with `status=applied`, today's date, company, role, source=url, other columns empty.
- Only one agent run at a time (the commands share state files).
- Never submit an application form or send a message on the user's behalf.

## Web layout (owned by typesetter + illustrator)

`web/App.tsx` (orchestrator-owned) composes:

```tsx
<DinerScene run={currentRun} onFetch={...} radio={state.radio} onRadioChange={...} />   // web/diner/DinerScene.tsx
<Newspaper edition={edition} state={state} run={currentRun} ... />                      // web/paper/Newspaper.tsx
<Notepad run={currentRun} question={pendingQuestion} onAnswer={...} />                  // web/paper/Notepad.tsx
```

Shared web client: `web/api.ts` (orchestrator-owned) - typed fetch helpers + `subscribeRun(id, onEvent)`.
Art: `web/art/` exports React SVG components (`<DachshundFetch/>`, `<DachshundSleep/>`, `<DachshundStretch/>`, `<DachshundTypewriter/>`, `<DachshundMasthead/>`), all `stroke="currentColor"`, line-art style matching black ink on newsprint.

Palette (newsprint, theme-independent): paper `#f3ead6`, ink `#2a2620`, marker `#c0392b`, diner mint `#9ccfc4`.
