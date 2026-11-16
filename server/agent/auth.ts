// Detect "not signed in" failures and build a friendly, platform-correct hint.
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, isAbsolute } from "node:path";

const AUTH_RE =
  /authentication_failed|not (logged|signed) in|please run \/login|run \/login|invalid api key|oauth token (has )?expired|token (has )?expired|invalid[_ ]grant|\b401\b|unauthori[sz]ed|authentication (error|failed)|credentials? (are |is )?(expired|invalid|missing)/i;

export function looksLikeAuthError(text: string | null | undefined): boolean {
  return !!text && AUTH_RE.test(text);
}

/** Locate the SDK's bundled native `claude` binary for this platform. */
export function findClaudeCli(): string | null {
  const require = createRequire(import.meta.url);
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  const base = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
  for (const name of [base, `${base}-musl`]) {
    try {
      const pkg = require.resolve(`${name}/package.json`);
      const bin = join(dirname(pkg), exe);
      if (existsSync(bin)) return bin;
    } catch {
      /* not installed */
    }
  }
  // Fallback: any platform package installed next to the SDK.
  try {
    const sdkDir = dirname(require.resolve("@anthropic-ai/claude-agent-sdk/package.json"));
    const scope = dirname(sdkDir);
    for (const d of readdirSync(scope)) {
      if (!d.startsWith("claude-agent-sdk-")) continue;
      const bin = join(scope, d, exe);
      if (existsSync(bin)) return bin;
    }
  } catch {
    /* SDK not resolvable */
  }
  return null;
}

export function authErrorMessage(repoRoot: string): string {
  const bin = findClaudeCli();
  let shown = "claude";
  if (bin) {
    const rel = relative(repoRoot, bin);
    shown = rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : bin;
  }
  return `Claude isn't signed in. In a terminal run: ${shown} auth login`;
}
