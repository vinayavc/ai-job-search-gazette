# The Sausage Gazette

A calm, newspaper-style front end for [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search). A little diorama town sits at the top of the page. A dachshund fetches today's paper (`/scrape`), the desk ranks the ads (`/rank`), you circle the ones you like, and one **Tailor** button has your resume and cover letter typed up for each (`/apply`). Then you open a job, read your pages and apply on the job site yourself. All of this happens without opening a terminal.

It runs your ai-job-search checkout's own commands through the Claude Agent SDK. It reads only that repo's standard files: `job_scraper/seen_jobs.json`, `job_search_tracker.csv`, `cv/`, `cover_letters/`, `documents/applications/` and `CLAUDE.md`. Everything stays on your computer.

See [NOTES.md](NOTES.md) for design decisions, how the diorama is built, and open items.

## Install

You need [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search) cloned and working, and Claude Code signed in. The Gazette uses that same login, so there's nothing else to sign in to.

### Where it goes

The Gazette lives **inside your ai-job-search folder**, in a subfolder called `ui/`. That's how it finds your jobs, tracker and CVs. You don't clone it yourself: the installer below puts it in the right place.

```text
ai-job-search/                    ← the folder you already use with Claude Code
├── CLAUDE.md                     your profile
├── job_search_tracker.csv        your applications
├── cv/  cover_letters/           your tailored pages
├── .claude/commands/gazette.md   ← added by the installer: the /gazette command
└── ui/                           ← the Sausage Gazette (this repo)
```

Both additions are ignored by ai-job-search's git on your machine, so they never show up in your commits or pull requests.

### The easy way: ask Claude

Open Claude Code in your ai-job-search folder and say:

> Install the Sausage Gazette from https://github.com/vinayavc/ai-job-search-gazette and open it.

Claude runs the installer, and the paper opens in your browser. After that, type **`/gazette`** in Claude Code whenever you want it.

### Or one command in a terminal

From your ai-job-search folder:

```bash
curl -fsSL https://raw.githubusercontent.com/vinayavc/ai-job-search-gazette/main/install.sh | bash
```

The installer:

1. Checks you're in an ai-job-search folder.
2. Offers to install [Bun](https://bun.sh), which runs the Gazette, if you don't have it.
3. Downloads the Gazette into a `ui/` folder and builds it.
4. Adds the **`/gazette`** command to Claude Code.
5. Tells ai-job-search's git to ignore both, on your machine only, so they never end up in your commits.
6. Opens the paper in your browser.

Run the same command again any time to update.

### Opening it later

- **In Claude Code:** type `/gazette`.
- **In a terminal:** run `ui/gazette` from your ai-job-search folder. Leave it running while you use the paper; Ctrl+C stops it.
- **Stopping it:** if it was started in the background (by Claude or the installer), run `ui/gazette --stop`, or ask Claude to stop it.

Either way the paper opens at **http://localhost:4747**. To try it without spending tokens, run `ui/gazette --fake`: every command plays a short scripted run, and your data isn't changed.

### Your first visit

A short tour opens by itself: the 17-second explainer video, then a walk around the page. It covers fetching, circling, Tailor, applying, the radio and adding a station. Replay it any time from **Take the tour** at the top of the paper.

- **No profile yet?** The paper shows **Subscribe to the Gazette**. Press **Start my subscription** to run `/setup`. Its questions appear on the order pad, the note that slides in at the bottom right, and you answer them there.
- **Profile already set up?** You go straight to the paper. Press **Fetch today's edition** at the top left for your first batch of ads.

<details>
<summary>Installing by hand</summary>

You'll need [Bun](https://bun.sh) (tested with 1.4). From your ai-job-search folder:

```bash
git clone https://github.com/vinayavc/ai-job-search-gazette.git ui
```

```bash
echo "/ui/" >> .git/info/exclude
```

```bash
ui/gazette
```

`ui/gazette` installs the packages and builds the page the first time. To keep the Gazette somewhere else, start it with `GAZETTE_JOB_REPO=/path/to/ai-job-search ui/gazette`.

</details>

Works on macOS and Linux. On Windows, use WSL. Saving the explainer as an MP4 needs Chrome or Edge; everything else works in any modern desktop browser.

## Using it day to day

1. **Fetch** the paper each morning. New ads are marked NEW and come first.
2. **Read and circle.** Click an ad to circle it with the red marker; "Read" opens the whole ad with the desk's notes.
3. **Tailor.** Press **Tailor all N circles** at the top of *Your circles*. Each circled ad goes to the typewriter in turn, so it takes a while; questions show up on the order pad. Each circle shows where it stands: not tailored yet, waiting its turn, being typed, pages ready, or sent.
4. **Apply.** Click a job in *Your circles*. Your tailored resume and cover letter come first. Read them, then press **Apply on the job site**, which opens the posting in a new tab. You fill in and send the application there yourself.
5. **File it.** Back in the Gazette, answer **Posted it? → Yes** to mark it sent in `job_search_tracker.csv`. The letterbox flag in the town stays up while you have tailored pages you haven't sent.

*Letters to the editor*, the last page of the classifieds, tracks the applications you have going.

## What it can and can't do on your computer

- **It runs the same commands you would.** `/scrape`, `/rank`, `/apply` and the rest come from your ai-job-search checkout, with that checkout's own settings. Runs use your Claude Code plan or API key, just as running them in the terminal would.
- **It asks before anything unusual.** Reading, searching and fetching web pages go ahead, and so do shell commands your checkout's Claude Code settings already allow. Any other shell command or connected tool is asked about on the order pad first, with Allow and Deny buttons.
- **It only writes inside your ai-job-search folder.** Writing anywhere else is refused, and edits to protected files are asked about first.
- **It never applies for you.** It never submits an application form or sends a message on your behalf. It only opens the posting.
- **It stays local.** The server listens only on your own machine (127.0.0.1). Your circles and radio settings live in `ui/.state/`, which git ignores.

## Updating

Run the install command again, or ask Claude to update the Sausage Gazette. It restarts the Gazette with the new version.

## Uninstalling

Delete the `ui` folder and `.claude/commands/gazette.md`, and remove their two lines from `ai-job-search/.git/info/exclude`. Your job data stays as it is. Outside `ui/`, the Gazette only ever changed what its runs of the ai-job-search commands wrote, plus the tracker rows you marked sent.

## Troubleshooting

- **"Can't find your ai-job-search folder."** The Gazette looks for `.claude/commands/rank.md` in its parent folder. Check that `ui` sits directly inside your ai-job-search checkout, or start it with `GAZETTE_JOB_REPO=/path/to/ai-job-search ui/gazette`.
- **`/gazette` doesn't show up in Claude Code.** Restart Claude Code in your ai-job-search folder so it picks up the new command.
- **A run stops with "Claude isn't signed in."** The order pad shows the exact command to run in a terminal to sign in. Run it, then try again.
- **"Port 4747 is already in use."** If it's the Gazette, `ui/gazette` notices and just opens it. If it's another program, start the Gazette on another port: `GAZETTE_PORT=4800 ui/gazette`.
- **The town header is blank or very slow.** It needs WebGL. Check that hardware acceleration is on in your browser's settings.

## How it works (the explainer)

Click "How it works" at the top of the paper, for a 17-second explainer with sound. **Save MP4** on that page renders it as a video in your browser (Chrome or Edge).

## Radio

The little radio at the top right is off until you press it. Click it for the dial: **Switch on**, then pick **Jazz**, **Lo-fi** or **Rain**, soft tunes generated in your browser.

**Adding a station:** press **+ Add a station** on the dial and paste a link to a station you like. Its normal "Listen live" web page is fine; the Gazette finds the stream on it. You can also paste a direct stream or a `.pls`/`.m3u` playlist. Name it, press **Add & play**, and it joins the dial with a red dot. **×** removes it. Your stations are saved with your other Gazette settings in `ui/.state/`.

If a station's page hides its stream, look for a "direct stream" or "listen in your own player" link, and paste that instead. HLS (`.m3u8`) streams aren't supported.

You can also stock the radio with your own music files, or list stations in a file. See [public/records/README.md](public/records/README.md).

## Development

`bun run dev` runs the Gazette with live reload at http://localhost:5174 (it doesn't open a browser tab).

```bash
bun test
```

```bash
bunx tsc --noEmit
```

`contract/` holds the shared types and API between `server/` and `web/`. NOTES.md explains the architecture and how to rebuild the diorama.

## License

MIT. See [LICENSE](LICENSE).
