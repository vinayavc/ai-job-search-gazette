---
description: Open the Sausage Gazette, the newspaper-style UI for your job search
---

Open the Sausage Gazette for the user. It's installed in `ui/` inside this repository.

1. If `ui/gazette` doesn't exist, the Gazette isn't installed. Offer to install it by running
   `curl -fsSL https://raw.githubusercontent.com/vinayavc/ai-job-search-gazette/main/install.sh | bash -s -- --no-start`
   from this repository's root, then continue with step 2.
2. Run `ui/gazette` with the Bash tool **in the background** (`run_in_background: true`). It installs what it
   needs, builds the page the first time, starts a local server and opens the browser. It keeps running until stopped.
3. Wait until its output says "The Sausage Gazette is open at" (or "already running"), then tell the user the
   address it printed, in one short line. If it printed an error instead, explain it plainly and suggest the fix.

If the user asked to try it without spending tokens, run `ui/gazette --fake` instead.
Don't stop the Gazette unless the user asks; when they do, stop that background task.
