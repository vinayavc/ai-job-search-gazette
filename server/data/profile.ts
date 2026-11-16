import { join } from "node:path";
import type { Profile } from "../../contract/types";
import { readText } from "./util";

/** Values the upstream template (and common hand edits) leave in place of a name. */
export function isPlaceholderName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/[\[\]{}<>]/.test(n)) return true;               // [YOUR_NAME], {name}, <name>
  if (/^(your|my|full)[\s_-]*name$/i.test(n)) return true;
  if (/^(tbd|todo|n\/?a|name|x+|\.{3}|-+)$/i.test(n)) return true;
  return false;
}

export function loadProfile(repoRoot: string): Profile {
  const text = readText(join(repoRoot, "CLAUDE.md"));
  if (text === null) return { name: null, hasProfile: false };
  const m = text.match(/^[ \t]*(?:[-*][ \t]+)?\*\*Name:\*\*[ \t]*(.*)$/m);
  if (!m) return { name: null, hasProfile: false };
  const name = m[1].replace(/<!--.*?-->/g, "").replace(/\s+$/, "").trim();
  if (isPlaceholderName(name)) return { name: null, hasProfile: false };
  return { name, hasProfile: true };
}
