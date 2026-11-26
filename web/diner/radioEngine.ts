// KDOX 87.9 - the diner radio. Plays /records/playlist.json files when present,
// otherwise synthesizes a quiet station with the Web Audio API. Live stations ("live:<id>") stream from the URLs
// in /records/stations.json or the ones added from the dial (saved in UI state). Never starts without a user click.
import type { LiveStation, RadioStation } from "../../contract/types";
export type Station = RadioStation;
interface Track { station: Station; file: string }

const LOOKAHEAD = 0.35;
const TICK_MS = 90;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function noiseBuffer(ctx: AudioContext, seconds: number, kind: "white" | "brown" | "crackle"): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = (Math.random() < 0.00035 ? w * 0.9 : 0) + w * 0.012; // sparse pops on a faint hiss
    }
  }
  return buf;
}

/** One running station: owns its nodes, fades in/out, cleans up after itself. */
interface Program { out: GainNode; stop(at: number): void; volume?(level: number): void }

function loopNoise(ctx: AudioContext, buf: AudioBuffer, dest: AudioNode, gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(g).connect(dest); src.start();
  return src;
}

/** Shared beat scheduler: calls onBeat(beatIndex, time) slightly ahead of time. */
function scheduler(ctx: AudioContext, bpm: number, onBeat: (beat: number, t: number, spb: number) => void) {
  const spb = 60 / bpm;
  let beat = 0;
  let next = ctx.currentTime + 0.15;
  const id = window.setInterval(() => {
    while (next < ctx.currentTime + LOOKAHEAD) { onBeat(beat++, next, spb); next += spb; }
  }, TICK_MS);
  return () => window.clearInterval(id);
}

function epiano(ctx: AudioContext, dest: AudioNode, midi: number, t: number, dur: number, vel: number) {
  const f = mtof(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
  g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const a = ctx.createOscillator(); a.type = "sine"; a.frequency.value = f; a.detune.value = rand(-4, 4);
  const b = ctx.createOscillator(); b.type = "sine"; b.frequency.value = f * 2;
  const bg = ctx.createGain(); bg.gain.setValueAtTime(0.25, t); bg.gain.exponentialRampToValueAtTime(0.01, t + 0.35); // bell-ish tine
  a.connect(g); b.connect(bg).connect(g); g.connect(dest);
  a.start(t); b.start(t); a.stop(t + dur + 0.05); b.stop(t + dur + 0.05);
}

function brush(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer, t: number, vel: number, len = 0.12) {
  const src = ctx.createBufferSource(); src.buffer = noise;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(hp).connect(g).connect(dest);
  src.start(t, Math.random() * 1.5, len + 0.05);
}

function bassNote(ctx: AudioContext, dest: AudioNode, midi: number, t: number, dur: number, vel: number) {
  const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(midi);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
}

function makeOut(ctx: AudioContext, dest: AudioNode) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.5);
  out.connect(dest);
  return out;
}

function finish(ctx: AudioContext, out: GainNode, at: number, cleanup: () => void) {
  out.gain.cancelScheduledValues(at);
  out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), at);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
  window.setTimeout(() => { cleanup(); out.disconnect(); }, Math.max(0, (at - ctx.currentTime + 1.4) * 1000));
}

// ii-V-I in F, a slow 70bpm swing with brushed hats and a walking bass.
function jazz(ctx: AudioContext, dest: AudioNode): Program {
  const out = makeOut(ctx, dest);
  const noise = noiseBuffer(ctx, 2, "white");
  const keys = ctx.createGain(); keys.gain.value = 0.07; keys.connect(out);
  const kit = ctx.createGain(); kit.gain.value = 0.05; kit.connect(out);
  const bass = ctx.createGain(); bass.gain.value = 0.16; bass.connect(out);
  const chords = [
    { root: 43, notes: [55, 58, 62, 65, 69] }, // Gm9
    { root: 48, notes: [52, 58, 62, 64, 69] }, // C13
    { root: 41, notes: [52, 57, 60, 64, 67] }, // Fmaj9
    { root: 38, notes: [54, 57, 60, 63, 66] }, // D7b9
  ];
  const walk = [0, 4, 7, 10];
  const stop = scheduler(ctx, 70, (beat, t, spb) => {
    const c = chords[Math.floor(beat / 4) % chords.length];
    const inBar = beat % 4;
    if (inBar === 0) c.notes.forEach((n, i) => epiano(ctx, keys, n, t + i * 0.012, spb * 2.6, 0.5));
    if (inBar === 1 && Math.random() < 0.6) c.notes.slice(1).forEach((n) => epiano(ctx, keys, n, t + spb * 0.66, spb * 1.2, 0.3));
    bassNote(ctx, bass, c.root + walk[inBar] - (inBar === 3 ? 1 : 0), t, spb * 0.95, 0.7);
    brush(ctx, kit, noise, t, inBar % 2 ? 0.6 : 0.3, 0.18);
    brush(ctx, kit, noise, t + spb * 0.66, 0.22, 0.08); // swung skip note
  });
  return { out, stop: (at) => finish(ctx, out, at, stop) };
}

// Mellow Fmaj7-Em7-Dm7-Cmaj7 through a low-pass, soft kick, and vinyl crackle.
function lofi(ctx: AudioContext, dest: AudioNode): Program {
  const out = makeOut(ctx, dest);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100; lp.Q.value = 0.4; lp.connect(out);
  const keys = ctx.createGain(); keys.gain.value = 0.08; keys.connect(lp);
  const drums = ctx.createGain(); drums.gain.value = 0.18; drums.connect(lp);
  const noise = noiseBuffer(ctx, 2, "white");
  const crackle = loopNoise(ctx, noiseBuffer(ctx, 4.7, "crackle"), out, 0.35);
  const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  const stop = scheduler(ctx, 74, (beat, t, spb) => {
    const inBar = beat % 4;
    const c = chords[Math.floor(beat / 4) % chords.length];
    if (inBar === 0) c.forEach((n, i) => epiano(ctx, keys, n, t + i * 0.03, spb * 3.8, 0.45));
    if (inBar === 2 && Math.random() < 0.5) epiano(ctx, keys, c[3] + 12, t + spb * 0.5, spb, 0.2);
    if (inBar === 0 || inBar === 2) bassNote(ctx, drums, c[0] - 12, t, spb * 1.6, 0.5);
    if (inBar === 0 || (inBar === 2 && Math.random() < 0.7)) {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(drums); o.start(t); o.stop(t + 0.35);
    }
    if (inBar === 1 || inBar === 3) brush(ctx, drums, noise, t, 0.25, 0.22);
    brush(ctx, drums, noise, t + spb * 0.5, 0.08, 0.05);
  });
  return { out, stop: (at) => finish(ctx, out, at, () => { stop(); crackle.stop(); }) };
}

// Steady rain on the window plus the odd car swishing past in the distance.
function rain(ctx: AudioContext, dest: AudioNode): Program {
  const out = makeOut(ctx, dest);
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 350;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
  hp.connect(lp).connect(out);
  const swell = ctx.createGain(); swell.gain.value = 0.22; swell.connect(hp);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.05; lfo.connect(lfoAmt).connect(swell.gain); lfo.start();
  const white = noiseBuffer(ctx, 3.3, "white");
  const bed = loopNoise(ctx, white, swell, 1);
  const rumble = loopNoise(ctx, noiseBuffer(ctx, 5.1, "brown"), out, 0.12);
  const drops = loopNoise(ctx, noiseBuffer(ctx, 3.9, "crackle"), lp, 0.5);
  let timer = 0;
  const car = () => {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(220, t);
    f.frequency.linearRampToValueAtTime(520, t + 2.6); f.frequency.linearRampToValueAtTime(240, t + 5.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(rand(0.06, 0.12), t + 2.6); g.gain.linearRampToValueAtTime(0.0001, t + 5.5);
    const pan = ctx.createStereoPanner(); const dir = Math.random() < 0.5 ? -1 : 1;
    pan.pan.setValueAtTime(-0.7 * dir, t); pan.pan.linearRampToValueAtTime(0.7 * dir, t + 5.5);
    src.connect(f).connect(g).connect(pan).connect(out); src.start(t); src.stop(t + 5.7);
    timer = window.setTimeout(car, rand(9000, 22000));
  };
  timer = window.setTimeout(car, rand(4000, 9000));
  return {
    out,
    stop: (at) => finish(ctx, out, at, () => { window.clearTimeout(timer); [bed, rumble, drops, lfo].forEach((n) => n.stop()); }),
  };
}

/** Shuffled playlist of real files for one station, crossfading between tracks. */
function records(ctx: AudioContext, dest: AudioNode, files: string[]): Program {
  const out = makeOut(ctx, dest);
  let order: string[] = [];
  let stopped = false;
  let current: { el: HTMLAudioElement; g: GainNode } | null = null;
  const nextFile = () => {
    if (!order.length) order = [...files].sort(() => Math.random() - 0.5);
    return order.pop()!;
  };
  const play = () => {
    if (stopped) return;
    const el = new Audio(`/records/${nextFile().replace(/^\/?records\//, "")}`);
    el.crossOrigin = "anonymous";
    const g = ctx.createGain(); g.gain.value = 0.0001;
    ctx.createMediaElementSource(el).connect(g).connect(out);
    const prev = current;
    current = { el, g };
    let handed = false;
    const handoff = () => { if (!handed) { handed = true; play(); } };
    el.addEventListener("timeupdate", () => { if (el.duration && el.duration - el.currentTime < 4) handoff(); });
    el.addEventListener("ended", handoff);
    el.addEventListener("error", () => window.setTimeout(handoff, 1500));
    el.play().then(() => {
      const t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.8, t + 3);
      if (prev) { prev.g.gain.setValueAtTime(Math.max(prev.g.gain.value, 0.0001), t); prev.g.gain.exponentialRampToValueAtTime(0.0001, t + 3); window.setTimeout(() => prev.el.pause(), 3200); }
    }).catch(() => window.setTimeout(handoff, 1500));
  };
  play();
  return { out, stop: (at) => { stopped = true; finish(ctx, out, at, () => current?.el.pause()); } };
}

/**
 * A live internet stream. Reconnects quietly if the stream drops.
 * Streams that allow cross-origin reads go through Web Audio (fades, the shared volume). Ones that don't would be
 * silent there, so they play straight from the element, with the volume set on the element itself.
 */
function stream(ctx: AudioContext, dest: AudioNode, url: string, cors: boolean, level: number): Program {
  const out = makeOut(ctx, dest);
  const el = new Audio();
  el.preload = "none";
  const g = ctx.createGain(); g.gain.value = 0.0001;
  if (cors) {
    el.crossOrigin = "anonymous";
    ctx.createMediaElementSource(el).connect(g).connect(out);
  } else {
    el.volume = level;
  }
  let stopped = false, retry = 0;
  const connect = () => {
    if (stopped) return;
    el.src = url + (url.includes("?") ? "&" : "?") + "gz=" + Date.now();   // a fresh connection, never a stale cached chunk
    el.play().then(() => {
      retry = 0;
      if (!cors) return;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.85, t + 2);
    }).catch(() => again());
  };
  const again = () => { if (!stopped) window.setTimeout(connect, Math.min(30000, 2000 * 2 ** retry++)); };
  el.addEventListener("error", again);
  el.addEventListener("ended", again);
  connect();
  const end = () => { el.pause(); el.removeAttribute("src"); el.load(); };
  return {
    out,
    stop: (at) => { stopped = true; if (cors) finish(ctx, out, at, end); else { end(); finish(ctx, out, at, () => {}); } },
    volume: cors ? undefined : (v) => { el.volume = Math.min(1, Math.max(0, v)); },
  };
}

let stationsPromise: Promise<LiveStation[]> | null = null;
/** Live stations from /records/stations.json (local, gitignored). Bad entries are skipped. */
export function loadLiveStations(): Promise<LiveStation[]> {
  stationsPromise ??= fetch("/records/stations.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((j) => (Array.isArray(j) ? j.filter((s): s is LiveStation =>
      !!s && typeof s.id === "string" && /^[a-z0-9-]{1,40}$/.test(s.id) && typeof s.name === "string" && s.name.trim() !== ""
      && typeof s.url === "string" && /^https?:\/\//.test(s.url)) : []))
    .catch(() => []);
  return stationsPromise;
}

let playlistPromise: Promise<Track[]> | null = null;
function loadPlaylist(): Promise<Track[]> {
  playlistPromise ??= fetch("/records/playlist.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((j) => (Array.isArray(j) ? j.filter((t) => t && typeof t.file === "string" && ["jazz", "lofi", "rain"].includes(t.station)) : []))
    .catch(() => []);
  return playlistPromise;
}

export class RadioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private program: Program | null = null;
  private station: Station | null = null;
  private token = 0;
  private level = 0.3;

  get started() { return this.ctx !== null; }

  /** Must be called from a user gesture the first time. */
  async play(station: Station, volume: number, added: LiveStation[] = []) {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.setVolume(volume);
    if (this.station === station && this.program) return;
    const token = ++this.token;
    const live = station.startsWith("live:")
      ? [...added, ...(await loadLiveStations())].find((s) => `live:${s.id}` === station)
      : undefined;
    const tracks = live ? [] : (await loadPlaylist()).filter((t) => t.station === station).map((t) => t.file);
    if (token !== this.token || !this.ctx || !this.master) return;
    this.program?.stop(this.ctx.currentTime);
    this.station = station;
    const ctx = this.ctx, dest = this.master;
    // a live station that's no longer listed falls back to the jazz tune
    this.program = live ? stream(ctx, dest, live.url, live.cors !== false, this.level) : tracks.length ? records(ctx, dest, tracks)
      : station === "lofi" ? lofi(ctx, dest) : station === "rain" ? rain(ctx, dest) : jazz(ctx, dest);
  }

  setVolume(v: number) {
    if (!this.ctx || !this.master) return;
    const level = Math.pow(Math.min(1, Math.max(0, v)), 2) * 0.9;
    this.level = level;
    this.master.gain.setTargetAtTime(level, this.ctx.currentTime, 0.08);
    this.program?.volume?.(level);
  }

  stop() {
    this.token++;
    if (!this.ctx) return;
    this.program?.stop(this.ctx.currentTime);
    this.program = null;
    this.station = null;
  }

  dispose() {
    this.stop();
    const ctx = this.ctx;
    this.ctx = null; this.master = null;
    if (ctx) window.setTimeout(() => ctx.close().catch(() => {}), 1600);
  }
}
