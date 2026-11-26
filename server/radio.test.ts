import { describe, expect, test } from "bun:test";
import { findStation, pageCandidates, playlistUrls, radioRoutes, StationError } from "./radio";

const ORIGIN = "http://localhost:4747";
type Reply = { status?: number; type: string; body?: string; headers?: Record<string, string> };

// A fake fetch over a little table of URLs, so no test touches the network.
function fakeFetch(table: Record<string, Reply>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const r = table[url];
    if (!r) throw new Error("unreachable: " + url);
    const res = new Response(r.body ?? "audio-bytes", { status: r.status ?? 200, headers: { "content-type": r.type, ...(r.headers ?? {}) } });
    Object.defineProperty(res, "url", { value: url });
    return res;
  }) as typeof fetch;
}

describe("radio: finding a station's stream", () => {
  test("a direct stream, with its icy-name and CORS", async () => {
    const f = fakeFetch({ "https://s.example/live": { type: "audio/mpeg", headers: { "icy-name": "Smooth FM", "access-control-allow-origin": ORIGIN } } });
    expect(await findStation("https://s.example/live", ORIGIN, f)).toEqual({ name: "Smooth FM", url: "https://s.example/live", cors: true });
  });

  test("a listen-live page: finds the <source> stream and names it from the title", async () => {
    const page = `<html><head><title>Listen Live online to Wave 98.3 FM</title></head><body>
      <a href="https://cdn.example/app.js">x</a><audio><source src="https://stream2.example:8152/stream?nocache=1"></audio></body></html>`;
    const f = fakeFetch({
      "https://wave.example/listen": { type: "text/html; charset=utf-8", body: page },
      "https://stream2.example:8152/stream?nocache=1": { type: "audio/mpeg" },
    });
    expect(await findStation("https://wave.example/listen", ORIGIN, f)).toEqual({ name: "Wave 98.3 FM", url: "https://stream2.example:8152/stream", cors: false });
  });

  test("a .pls playlist", async () => {
    const f = fakeFetch({
      "https://r.example/tune.pls": { type: "audio/x-scpls", body: "[playlist]\nFile1=https://r.example:8000/hi\nTitle1=Hi\n" },
      "https://r.example:8000/hi": { type: "audio/aac", headers: { "access-control-allow-origin": "*" } },
    });
    expect(await findStation("https://r.example/tune.pls", ORIGIN, f)).toMatchObject({ url: "https://r.example:8000/hi", cors: true });
  });

  test("plain-language failures", async () => {
    const f = fakeFetch({
      "https://x.example/page": { type: "text/html", body: "<html><title>Nothing</title></html>" },
      "https://x.example/hls.m3u8": { type: "application/vnd.apple.mpegurl", body: "#EXTM3U" },
    });
    await expect(findStation("not a link", ORIGIN, f)).rejects.toBeInstanceOf(StationError);
    await expect(findStation("https://x.example/page", ORIGIN, f)).rejects.toThrow(/Couldn't find the station's stream/);
    await expect(findStation("https://x.example/hls.m3u8", ORIGIN, f)).rejects.toThrow(/HLS/);
    await expect(findStation("https://down.example/", ORIGIN, f)).rejects.toThrow(/Couldn't reach/);
  });

  test("helpers", () => {
    expect(playlistUrls("#EXTM3U\n#EXTINF:-1,X\nhttp://a.example/s\n", "http://a.example/")).toEqual(["http://a.example/s"]);
    expect(pageCandidates(`<script src="https://x.example/stream.js"></script> https://facebook.com/live https://ice.example:8000/live.mp3`, "https://p.example/"))
      .toEqual(["https://ice.example:8000/live.mp3"]);
  });

  test("route: 400 without a link, 422 with a reason", async () => {
    const route = radioRoutes(fakeFetch({}))["POST /api/radio/find"];
    const call = (body: unknown) => route(new Request("http://localhost/api/radio/find", { method: "POST", body: JSON.stringify(body), headers: { origin: ORIGIN } }), {});
    expect((await call({})).status).toBe(400);
    const r = await call({ url: "https://down.example/" });
    expect(r.status).toBe(422);
    expect(((await r.json()) as { error: string }).error).toMatch(/Couldn't reach/);
  });
});
