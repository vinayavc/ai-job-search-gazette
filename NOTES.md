# Sausage Gazette: handoff notes

Read this before changing the UI. `README.md` covers installing and running; this file covers why it is built the way it is, how the pieces fit, and what is still open.

## What it is

A calm, newspaper-style front end for [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search). A three.js "Tiny Diorama" header (a little town on a floating tile) shows each stage of the job search as it happens. Below it, *The Sausage Gazette* holds the classifieds (scraped jobs), your circles, the pipeline and letters to the editor. Everything from scrape to apply runs from the page.

This folder is its own git repo (private `ai-job-search-gazette`). It sits inside an ai-job-search checkout as `ui/` and is excluded there through `.git/info/exclude`. Never commit it into ai-job-search.

## Product decisions (agreed with the owner)

- **The diorama is a header**, pinned at the top of the screen, not the whole app.
- **One screen, no page scroll.** The town stays on top, "Your circles" stays fixed on the left, and the classifieds are measured pages you flip (buttons, arrow keys, swipe). Letters to the editor is the last page.
- **You circle; the AI ranks.** `/rank` stamps fit scores. The dog never circles for you.
- **"Tailor" only drafts, and there is one Tailor button.** It sits at the top of Your circles and sends every circled ad that has no pages yet to `/apply`, one run at a time (the queue lives in `App.tsx`; a cancelled run stops the rest, a failed one doesn't). Ads and job pages have no Tailor buttons of their own; circling is how you pick.
- **The job page leads with your pages.** Click a job in Your circles: the tailored resume and cover letter come first, then **"Apply on the job site"**, which opens the posting. You apply there yourself; answering **"Posted it?" → Yes** marks it sent in the tracker.
- **Your circles folds away.** The open/closed state is `circlesOpen` in UI state. Each circle shows where it stands: not tailored yet, waiting its turn, being typed, pages ready, sent.
- **The letterbox flag means drafts you haven't sent yet.** It's a quiet reminder, not a badge.
- **Calm by design:** no alarm colours, no unread counts shouting.
- **The radio lives in the page** (top right of the header), not in the scene. It's off until clicked, and plays generated jazz, lo-fi or rain, or your own files in `public/records/`. Live internet stations come from `public/records/stations.json` (gitignored, so the owner's stations, such as WAVE 98.3, stay local); they show as a row under the built-in three, and the state stores them as `live:<id>`.
- **The dog's name is a setting** (`dogName` in UI state, default "Doxie"). The owner's dog is Zoë; set it in the sidebar's "Your pup" field.
- **Works for any ai-job-search user.** It reads only the repo's standard files (`job_scraper/seen_jobs.json`, `job_search_tracker.csv`, `cv/`, `cover_letters/`, `documents/applications/`, `CLAUDE.md`). Never `LATEST_SCRAPE.md` or `APPLY_LINKS.md`, which are personal additions in the owner's fork. Nothing personal is hard-coded.
- **Never submit a form or send a message** on the user's behalf.

## How the pieces fit

| Area | What it does |
|---|---|
| `contract/` | Shared types and the API between server and web. Change it first. |
| `server/data/` | Reads jobs, tracker, docs and profile; UI state in `<job repo>/ui/.state/`; marks applications sent. |
| `server/agent/` | Runs the repo's slash commands through the Claude Agent SDK; one run at a time; relays questions to the order pad. `GAZETTE_FAKE_AGENT=1` plays scripted runs. |
| `web/paper/` | The newspaper: `Newspaper`, paged `Classifieds` (`ClassifiedPages` measures ads and packs pages), `AdDetail`, `Letters`, `Notepad` (the order pad). |
| `web/diorama/` | `DioramaHeader.tsx` plays story beats per stage; `stage.js` (rendering kit) and `scene.js` (the town) are **generated**, so don't edit them. |
| `web/diner/` | Only the radio: `Radio.tsx`, `radioEngine.ts`, `radio.css`. |
| `web/explainer.html`, `web/explainer/` | The 16:9 explainer player (`/explainer.html`, linked as "How it works"): play/pause, scrub, time, sound, loop, beat jumps, and "Save MP4". |
| `diorama-wip/` | The diorama's source files and storyboard tooling. |

### Editing the diorama

1. Edit the sources in `diorama-wip/`: `part_content.js` (stops, road, palette, the timing schedule `T`, beats and captions) and `part_story.js` (props, characters, choreography, sound score). `part_kit.js` is the reference "Tiny Diorama" kit, kept unchanged, and `stage.js` is the STAGE rendering kit, also unchanged.
2. Run `python3 diorama-wip/build.py`. It regenerates `web/diorama/stage.js` and `web/diorama/scene.js` (plus the storyboard files, which are gitignored).
   It also copies `diorama-wip/sound.js` (the SOUND kit) to `web/diorama/sound.js`.
3. Keep `update(t)` a pure function of time: no `Math.random`, `Date` or timers (use `K.rng`).

**App hooks:** the header drives the scene through `window.__gazetteApp`:
- `ambient` is a wall clock for idle life while holding a beat.
- `flag` reflects your unsent drafts.
- `ring: false` turns off the explainer's circle.
- `captions: false` turns off the explainer's captions.
- `zoom` and `lift` set the wide-strip framing.
- `lite` uses smaller shadow maps.

Without the hooks, the scene behaves as the 16:9 explainer.

**Stage to beat mapping** (`DioramaHeader.tsx`). Beats queue and play in order and are never skipped; while waiting, the scene holds with the town still alive.

| When | Story time |
|---|---|
| `/scrape` running | 0 → 3.4 (press, drive) |
| `/scrape` done | → 5.25 (paper on the mat) |
| `/rank` | 5.25 → 6.7, then → 7.55 |
| `/apply` | 7.6 → 9.0 (typing), then → 11.25 (posted, flag up) |
| "Posted it?" → Yes | 11.2 → 17 (you hand it over; dusk delivery) |
| Resting | 11.25 |

## Running a safe demo

Run against a **copy** of the job data so nothing touches the real tracker:

```bash
GAZETTE_FAKE_AGENT=1 GAZETTE_FAKE_STEP_MS=500 GAZETTE_JOB_REPO=/path/to/a/copy bun run dev
```

The copy needs `job_scraper/seen_jobs.json`, `job_search_tracker.csv`, `CLAUDE.md`, `.claude/commands/rank.md` (used to recognise the folder), and optionally `cv/` and `cover_letters/` PDFs. Fake runs don't change the data: ads stay "waiting for the desk" and tailoring adds no draft.

The Claude Code desktop app's browser pane throttles animation to about 1–2 fps. Judge motion in a real browser, where it runs at about 47 fps on an M1.

## The explainer video

`/explainer.html` plays the scene as the 17-second, six-beat explainer (storyboard: claude.ai artifact `ABy5fDiktTNoqCtjn9kMwK`). It renders one sample per frame while playing. The score is `sound(k)` in `part_story.js`, rendered once offline by `K.renderScore` in `diorama-wip/sound.js` (all synthesised and seeded, so it's the same every time).

**MP4 without ffmpeg.** "Save MP4" renders every frame at the chosen sample count and encodes in the browser with WebCodecs (H.264 + AAC, falling back to Opus), muxed by `mp4-muxer`. To render from the command line with headless Chrome while `bun run dev` is running:

```bash
bun diorama-wip/render.mjs media/sausage-gazette-explainer.mp4 16
```

Samples: 1 takes about 15 s, 16 a few minutes, 72 (the style's own setting, softest motion blur) much longer. `media/` is gitignored.

## Open items

- **The explainer's sound has only been checked by its levels** (peak about 0.75, nothing silent, no clipping), not by ear. The presets in `sound.js` are first drafts; tune them by listening.
- **The tailor queue lives in the browser tab.** Reloading the page mid-queue finishes the current `/apply` but forgets the rest.
- **The SENT beat's framing in the header** cuts off the office and its mail slot at the top right.
- **Time of day doesn't follow the user's clock** in the idle scene (planned: morning light, dusk lamps, dog asleep at night).
- **Never tested with real runs.** All testing so far was fake mode, with no real `/scrape`, `/rank` or `/apply`.
- **Lots of pages on a phone** (about 19 with 3 ads each). A "Circled only" view or jump-to-page could help.
- **`window.__dioStage`** is exposed for console debugging; remove it once settled.
