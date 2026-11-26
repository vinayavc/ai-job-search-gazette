// The radio's "Add a station": turn whatever link the user has for a station into a stream the browser can play.
// People usually have the station's "listen live" web page, not its stream, so this accepts:
//   - a direct audio stream (Icecast/Shoutcast MP3, AAC, Ogg)
//   - a .pls or .m3u playlist that lists streams
//   - a web page that plays the station (its <audio>/<source> tags and stream-looking links are tried in turn)
// Only reads: it never logs in, posts or follows more than one page deep.
import type { FoundStation } from "../contract/types";
import type { RouteHandler } from "./index";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const AUDIO = /^(audio\/(mpeg|mp3|aac|aacp|ogg|opus|x-aac|mp4|wav|webm)|application\/ogg)/i;
const PLAYLIST = /^(audio\/(x-scpls|scpls|x-mpegurl|mpegurl)|application\/(pls\+xml|x-mpegurl))/i;
const HLS = /^application\/vnd\.apple\.mpegurl/i;
const MAX_PAGE = 1_500_000;
const MAX_CANDIDATES = 14;

export class StationError extends Error {}

type Fetcher = typeof fetch;
interface Probe { kind: "audio" | "playlist" | "page" | "other"; type: string; res: Response; url: string }

async function probe(url: string, origin: string, f: Fetcher, ms = 7000): Promise<Probe | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const res = await f(url, { signal: ac.signal, redirect: "follow", headers: { "User-Agent": UA, Origin: origin, Accept: "*/*", "Icy-MetaData": "0" } });
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    const finalUrl = res.url || url;
    if (!res.ok) { ac.abort(); return null; }
    if (AUDIO.test(type)) return { kind: "audio", type, res, url: finalUrl };
    if (PLAYLIST.test(type) || /\.(pls|m3u)(\?|$)/i.test(finalUrl)) return { kind: "playlist", type, res, url: finalUrl };
    if (HLS.test(type) || /\.m3u8(\?|$)/i.test(finalUrl)) return { kind: "other", type: "hls", res, url: finalUrl };
    if (type.includes("html")) return { kind: "page", type, res, url: finalUrl };
    return { kind: "other", type, res, url: finalUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readText(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < max) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value); size += value.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const done = (p: Probe) => { p.res.body?.cancel().catch(() => {}); };

/** True when a browser on `origin` may read the stream (needed to route it through Web Audio). */
function allowsCors(res: Response, origin: string): boolean {
  const acao = res.headers.get("access-control-allow-origin");
  return acao === "*" || acao === origin;
}

function streamName(p: Probe): string | null {
  const n = p.res.headers.get("icy-name")?.trim();
  return n && n.length <= 60 && !/^(no name|unspecified|\(null\))$/i.test(n) ? n : null;
}

export function playlistUrls(text: string, base: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = /^File\d+\s*=\s*(.+)$/i.exec(line);
    const u = m ? m[1].trim() : !line.startsWith("#") && line ? line : null;
    if (!u) continue;
    try { const abs = new URL(u, base).toString(); if (/^https?:/i.test(abs)) out.push(abs); } catch { /* not a URL */ }
  }
  return out;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#0?38;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Stream-looking URLs on a page, best guesses first: <audio>/<source> tags, then links that look like streams. */
export function pageCandidates(html: string, base: string): string[] {
  const seen = new Set<string>(), out: string[] = [];
  const add = (u: string) => {
    try {
      const abs = new URL(decode(u.trim()), base).toString();
      if (!/^https?:/i.test(abs) || seen.has(abs)) return;
      seen.add(abs); out.push(abs);
    } catch { /* not a URL */ }
  };
  for (const m of html.matchAll(/<(?:audio|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
  const STREAMY = /(stream|listen|live|icecast|shoutcast|radio|\.mp3|\.aac|\.ogg|\.pls|\.m3u(?!8)|:\d{4,5}\/)/i;
  const SKIP = /\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|json)(\?|$)|facebook|twitter|instagram|youtube|google|doubleclick|apple\.com|amazon\.|tunein\.com|itunes/i;
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>()\\]+/gi)) {
    const u = m[0];
    if (STREAMY.test(u) && !SKIP.test(u)) add(u);
  }
  return out.slice(0, MAX_CANDIDATES);
}

function pageName(html: string): string | null {
  const og = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];
  const raw = decode((og ?? title ?? "").trim());
  if (!raw) return null;
  // "Listen Live online to Wave 98.3 FM" -> "Wave 98.3 FM"; "Station | Listen live" -> "Station"
  const cleaned = raw.replace(/^(listen( live)?( online)?( to)?)\s+/i, "").split(/\s+[|\-–—:]\s+/)[0].trim();
  return cleaned ? cleaned.slice(0, 40) : null;
}

/** Players add one-off numbers like ?nocache=1795658959; the radio adds its own, so keep the saved link clean. */
export function withoutCacheBuster(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(nocache|cache|cb|_|t|ts|rnd|rand)$/i.test(k) && /^\d*$/.test(u.searchParams.get(k) ?? "")) u.searchParams.delete(k);
    return u.toString();
  } catch { return url; }
}

function nameFromHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").split(".")[0].slice(0, 40) || "Live radio"; } catch { return "Live radio"; }
}

/** Resolve a station link to a playable stream. Throws StationError with a plain-language reason. */
export async function findStation(input: string, origin: string, f: Fetcher = fetch): Promise<FoundStation> {
  let start: URL;
  try { start = new URL(input.trim()); } catch { throw new StationError("That doesn't look like a web link. Paste the whole address, starting with http:// or https://."); }
  if (!/^https?:$/.test(start.protocol)) throw new StationError("Only http:// and https:// links work here.");

  const first = await probe(start.toString(), origin, f);
  if (!first) throw new StationError("Couldn't reach that link. Check it opens in your browser, then try again.");

  const fromAudio = (p: Probe, name: string | null): FoundStation => {
    done(p);
    // a page's own name ("Wave 98.3 FM") reads better than a stream's call sign ("CIWV")
    return { name: (name ?? streamName(p) ?? nameFromHost(p.url)).slice(0, 40), url: withoutCacheBuster(p.url), cors: allowsCors(p.res, origin) };
  };
  const tryList = async (urls: string[], name: string | null): Promise<FoundStation | null> => {
    for (const u of urls) {
      const p = await probe(u, origin, f, 5000);
      if (!p) continue;
      if (p.kind === "audio") return fromAudio(p, name);
      if (p.kind === "playlist") {   // a page linking a .pls: one more level, no further
        const inner = playlistUrls(await readText(p.res, 64_000), p.url);
        for (const iu of inner.slice(0, 4)) {
          const q = await probe(iu, origin, f, 5000);
          if (q?.kind === "audio") return fromAudio(q, name);
          if (q) done(q);
        }
        continue;
      }
      done(p);
    }
    return null;
  };

  if (first.kind === "audio") return fromAudio(first, null);
  if (first.type === "hls") { done(first); throw new StationError("That's an HLS (.m3u8) stream, which the radio can't play. Look for an MP3 or AAC stream link instead."); }
  if (first.kind === "playlist") {
    const found = await tryList(playlistUrls(await readText(first.res, 64_000), first.url), null);
    if (found) return found;
    throw new StationError("That playlist doesn't list a stream the radio can play.");
  }
  if (first.kind === "page") {
    const html = await readText(first.res, MAX_PAGE);
    const found = await tryList(pageCandidates(html, first.url), pageName(html));
    if (found) return found;
    throw new StationError("Couldn't find the station's stream on that page. Some players hide it; look for a \"direct stream\" or \"listen in your own player\" link (often ending in .mp3, .aac or .pls) and paste that instead.");
  }
  done(first);
  throw new StationError("That link isn't a radio stream or a page with one on it.");
}

export function radioRoutes(f: Fetcher = fetch): Record<string, RouteHandler> {
  return {
    "POST /api/radio/find": async (req) => {
      let body: unknown;
      try { body = await req.json(); } catch { body = null; }
      const url = body && typeof body === "object" && typeof (body as { url?: unknown }).url === "string" ? (body as { url: string }).url : "";
      if (!url.trim()) return Response.json({ error: "Paste a link to the station first." }, { status: 400 });
      const origin = req.headers.get("origin") ?? `http://${req.headers.get("host") ?? "localhost"}`;
      try {
        return Response.json(await findStation(url, origin, f));
      } catch (err) {
        if (err instanceof StationError) return Response.json({ error: err.message }, { status: 422 });
        throw err;
      }
    },
  };
}
