#!/usr/bin/env bash
# Install or update the Sausage Gazette inside your ai-job-search folder, then open it.
#
# From your ai-job-search folder:
#   curl -fsSL https://raw.githubusercontent.com/vinayavc/ai-job-search-gazette/main/install.sh | bash
#
# Options (after "bash -s --" when piping):
#   --yes        install Bun without asking, if it's missing
#   --no-start   set everything up but don't start the Gazette
# Run it again any time to update.
set -euo pipefail

REPO_URL="${GAZETTE_REPO_URL:-https://github.com/vinayavc/ai-job-search-gazette.git}"   # a fork can set GAZETTE_REPO_URL
YES=0
START=1
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    --no-start) START=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ -t 1 ]; then say() { printf '\n\033[1m%s\033[0m\n' "$*"; }; else say() { printf '\n%s\n' "$*"; }; fi
fail() { printf '\n%s\n' "$*" >&2; exit 1; }

# 1. Find the ai-job-search checkout: here, the folder above (if run from ui/), or ./ai-job-search.
ROOT=""
for d in "${AI_JOB_SEARCH_DIR:-}" "$PWD" "$PWD/.." "$PWD/ai-job-search"; do
  if [ -n "$d" ] && [ -f "$d/.claude/commands/rank.md" ]; then ROOT="$(cd "$d" && pwd)"; break; fi
done
[ -n "$ROOT" ] || fail "Run this from your ai-job-search folder (the one with .claude/commands/rank.md),
or set AI_JOB_SEARCH_DIR=/path/to/ai-job-search. Don't have it yet? See https://github.com/ai-job-search-dev/ai-job-search"
say "Found ai-job-search at $ROOT"

command -v git >/dev/null 2>&1 || fail "The installer needs git. Install it, then run this again."

# 2. Bun, which runs the Gazette.
if ! command -v bun >/dev/null 2>&1 && [ -x "$HOME/.bun/bin/bun" ]; then export PATH="$HOME/.bun/bin:$PATH"; fi
if ! command -v bun >/dev/null 2>&1; then
  if [ "$YES" != 1 ]; then
    if [ -r /dev/tty ] && [ -t 1 ]; then
      printf '\nThe Gazette runs on Bun (https://bun.sh), which isn'"'"'t installed. Install it now? [Y/n] '
      read -r answer </dev/tty || answer=n
      case "$answer" in ""|y|Y|yes|Yes) YES=1 ;; esac
    fi
  fi
  [ "$YES" = 1 ] || fail "The Gazette needs Bun. Install it with:
  curl -fsSL https://bun.sh/install | bash
then run this installer again (or add --yes to let it install Bun for you)."
  say "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# 3. Clone the Gazette into ui/, or update it.
UI="$ROOT/ui"
if [ -d "$UI/.git" ]; then
  say "Updating the Gazette in ui/"
  git -C "$UI" pull --ff-only || fail "Couldn't update ui/ (local changes?). Commit or stash them, then run this again."
elif [ -e "$UI" ]; then
  fail "There's already a ui/ folder in $ROOT that isn't the Gazette. Move it aside, then run this again."
else
  say "Downloading the Gazette into ui/"
  git clone --quiet "$REPO_URL" "$UI"
fi

# 4. Keep ui/ and the /gazette command out of ai-job-search's commits (on this machine only).
EXCLUDE="$(git -C "$ROOT" rev-parse --git-path info/exclude 2>/dev/null || true)"
if [ -n "$EXCLUDE" ]; then
  case "$EXCLUDE" in /*) ;; *) EXCLUDE="$ROOT/$EXCLUDE" ;; esac
  mkdir -p "$(dirname "$EXCLUDE")"; touch "$EXCLUDE"
  for line in "/ui/" "/.claude/commands/gazette.md"; do grep -qxF "$line" "$EXCLUDE" || echo "$line" >> "$EXCLUDE"; done
fi

# 5. The /gazette command for Claude Code.
cp "$UI/claude/gazette.md" "$ROOT/.claude/commands/gazette.md"

# 6. Packages and the first build.
say "Installing packages and building the page..."
(cd "$UI" && { bun install --frozen-lockfile >/dev/null 2>&1 || bun install; } && touch node_modules && { bun run build >/dev/null 2>&1 || bun run build; })

say "The Sausage Gazette is installed."
echo "Open it any time with /gazette in Claude Code, or run: ui/gazette"
echo "It uses your Claude Code login. Try it without spending tokens: ui/gazette --fake"

[ "$START" = 1 ] || exit 0
"$UI/gazette" --stop >/dev/null 2>&1 || true   # after an update, restart so the new version loads
sleep 1
if [ -t 1 ]; then
  exec "$UI/gazette"   # in a terminal: runs here until Ctrl+C
fi
# Not in a terminal (for example, Claude Code ran this): start it in the background and return once it's open.
mkdir -p "$UI/.state"
nohup "$UI/gazette" >"$UI/.state/gazette.log" 2>&1 &
for _ in $(seq 1 60); do
  if grep -q "is open at\|already running" "$UI/.state/gazette.log" 2>/dev/null; then
    grep -o "http://localhost:[0-9]*" "$UI/.state/gazette.log" | head -1 | sed 's/^/The Sausage Gazette is open at /'
    echo "It keeps running in the background. Stop it with: ui/gazette --stop"
    exit 0
  fi
  sleep 1
done
fail "The Gazette didn't start. Its log is in ui/.state/gazette.log"
