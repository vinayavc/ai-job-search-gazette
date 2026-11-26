/// <reference types="dom-webcodecs" />
// The 16:9 explainer: the same Tiny Diorama scene as the header, played as one 17-second film with its sound score.
// Without window.__gazetteApp the scene runs as the explainer (captions and the marker ring on, full framing).
//
// Playback renders one sample per frame; "Save MP4" renders each frame at the chosen sample count and encodes it in
// the browser with WebCodecs (H.264 + AAC, muxed by mp4-muxer), so no ffmpeg is needed.
import * as THREE from "three";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import "./explainer.css";

type Beat = { t0: number; t1: number; tag: string; text: string };
interface Style { duration: number; beats: Beat[]; sound?: (k: unknown) => void }
interface Stage { seek: (t: number, samples?: number) => void }
interface Kit {
  run: (c: HTMLCanvasElement, style: Style, o: object) => Promise<Stage>;
  renderScore: (style: Style, o?: { sampleRate?: number }) => Promise<AudioBuffer | null>;
}
const G = window as unknown as { THREE: unknown; K: Kit; STYLES: Style[]; __gazetteApp?: unknown; __explainer?: unknown };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("stage");
const playBtn = $<HTMLButtonElement>("play"), bigPlay = $<HTMLButtonElement>("bigplay");
const scrub = $<HTMLInputElement>("scrub"), timeEl = $("time");
const soundBtn = $<HTMLButtonElement>("sound"), loopBtn = $<HTMLButtonElement>("loop");
const beatsEl = $("beats"), loading = $("loading");
const exportBtn = $<HTMLButtonElement>("export"), cancelBtn = $<HTMLButtonElement>("cancel"), quality = $<HTMLSelectElement>("quality");
const progress = $("progress"), bar = $("bar"), progressText = $("progress-text"), download = $("download");

const FPS = 30, W = 1920, H = 1080, AUDIO_RATE = 48000;
const pref = (k: string, d: boolean) => { try { const v = localStorage.getItem("gz-ex-" + k); return v === null ? d : v === "1"; } catch { return d; } };
const savePref = (k: string, v: boolean) => { try { localStorage.setItem("gz-ex-" + k, v ? "1" : "0"); } catch { /* private mode */ } };

let S: Stage, style: Style, dur = 17;
let t = 0, playing = false, exporting = false, dirty = true;
let soundOn = pref("sound", true), loop = pref("loop", true);
let wall0 = 0, t0 = 0;
let actx: AudioContext | null = null, src: AudioBufferSourceNode | null = null;
let score: Promise<AudioBuffer | null> | null = null, scoreBuf: AudioBuffer | null = null;

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function getScore() {
  if (!score) score = G.K.renderScore(style, { sampleRate: AUDIO_RATE }).then((b) => (scoreBuf = b)).catch((e) => { console.error(e); return null; });
  return score;
}

function stopAudio() {
  if (src) { try { src.stop(); } catch { /* already stopped */ } src.disconnect(); src = null; }
}
async function startAudio() {
  stopAudio();
  if (!soundOn || !playing) return;
  const buf = scoreBuf ?? (await getScore());
  if (!buf || !playing || !soundOn) return;
  actx ??= new AudioContext({ sampleRate: AUDIO_RATE });
  await actx.resume();
  // re-read the clock after the await so picture and sound start together
  const now = clockNow();
  src = actx.createBufferSource(); src.buffer = buf; src.connect(actx.destination);
  src.start(0, Math.min(now, buf.duration - 0.01));
}

const clockNow = () => (playing ? t0 + (performance.now() - wall0) / 1000 : t);

function play() {
  if (exporting) return;
  if (t >= dur - 0.02) t = 0;
  playing = true; t0 = t; wall0 = performance.now();
  void startAudio();
  syncUi();
}
function pause() {
  if (playing) t = Math.min(dur, clockNow());
  playing = false; stopAudio(); syncUi();
}
function seek(to: number) {
  t = Math.max(0, Math.min(dur, to)); dirty = true;
  if (playing) { t0 = t; wall0 = performance.now(); void startAudio(); }
  syncUi();
}

let lastBeat = -1;
function syncUi() {
  playBtn.classList.toggle("is-playing", playing);
  playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  bigPlay.hidden = playing || exporting || !S;
  timeEl.textContent = `${fmt(t)} / ${fmt(dur)}`;
  if (document.activeElement !== scrub) scrub.value = String(t);
  soundBtn.setAttribute("aria-pressed", String(soundOn));
  loopBtn.setAttribute("aria-pressed", String(loop));
  const bi = style ? style.beats.findIndex((b) => t >= b.t0 && t < b.t1) : -1;
  if (bi !== lastBeat) {
    lastBeat = bi;
    beatsEl.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", String(i === bi)));
  }
}

function frame() {
  requestAnimationFrame(frame);
  if (!S || exporting) return;
  if (playing) {
    let now = clockNow();
    if (now >= dur) {
      if (loop) { now = 0; t0 = 0; wall0 = performance.now(); void startAudio(); }
      else { t = dur; pause(); now = dur; }
    }
    t = now; dirty = true;
    syncUi();
  }
  if (dirty) { S.seek(t, 1); dirty = false; }
}

// ---------------------------------------------------------------- MP4 export (WebCodecs + mp4-muxer)
let stopRequested = false;

async function pickAudioCodec(): Promise<null | { muxer: "aac" | "opus"; enc: AudioEncoderConfig }> {
  if (typeof AudioEncoder === "undefined") return null;
  for (const [muxer, codec] of [["aac", "mp4a.40.2"], ["opus", "opus"]] as const) {
    const enc: AudioEncoderConfig = { codec, sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: 192_000 };
    try { if ((await AudioEncoder.isConfigSupported(enc)).supported) return { muxer, enc }; } catch { /* try the next */ }
  }
  return null;
}

async function exportMp4(samples: number, onProgress: (done: number, total: number, label: string) => void): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") throw new Error("This browser can't encode video (WebCodecs is missing). Try a recent Chrome or Edge.");
  let vcfg: VideoEncoderConfig | null = null;
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42003e"]) {
    const c: VideoEncoderConfig = { codec, width: W, height: H, bitrate: 14_000_000, framerate: FPS };
    if ((await VideoEncoder.isConfigSupported(c)).supported) { vcfg = c; break; }
  }
  if (!vcfg) throw new Error("This browser can't encode H.264 video.");
  const audio = await pickAudioCodec();

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: "in-memory", firstTimestampBehavior: "offset",
    video: { codec: "avc", width: W, height: H, frameRate: FPS },
    ...(audio ? { audio: { codec: audio.muxer, numberOfChannels: 2, sampleRate: AUDIO_RATE } } : {}),
  });
  let failure: unknown = null;
  const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { failure = e; } });
  ve.configure(vcfg);

  const frames = Math.round(dur * FPS);
  for (let i = 0; i < frames; i++) {
    if (stopRequested) { ve.close(); throw new Error("stopped"); }
    if (failure) throw failure;
    S.seek(i / FPS, samples);
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    ve.encode(vf, { keyFrame: i % (FPS * 2) === 0 });
    vf.close();
    if (ve.encodeQueueSize > 6) await new Promise((r) => ve.addEventListener("dequeue", r, { once: true }));
    onProgress(i + 1, frames, `Frame ${i + 1} of ${frames}`);
    await new Promise((r) => setTimeout(r, 0));   // let the page breathe (progress bar, Stop button)
  }
  await ve.flush(); ve.close();

  if (audio) {
    onProgress(frames, frames, "Mixing the sound");
    const buf = scoreBuf ?? (await getScore());
    if (buf) {
      const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { failure = e; } });
      ae.configure(audio.enc);
      const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
      const total = Math.min(buf.length, Math.round(dur * AUDIO_RATE)), step = 4800;
      for (let off = 0; off < total; off += step) {
        const n = Math.min(step, total - off), data = new Float32Array(n * 2);
        data.set(L.subarray(off, off + n), 0); data.set(R.subarray(off, off + n), n);
        const ad = new AudioData({ format: "f32-planar", sampleRate: AUDIO_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off * 1e6) / AUDIO_RATE), data });
        ae.encode(ad); ad.close();
      }
      await ae.flush(); ae.close();
    }
  }
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([target.buffer], { type: "video/mp4" });
}

async function runExport() {
  if (exporting) return;
  pause();
  exporting = true; stopRequested = false;
  exportBtn.disabled = true; cancelBtn.hidden = false; quality.disabled = true;
  playBtn.disabled = true; scrub.disabled = true;
  progress.hidden = false; download.hidden = true; bar.style.width = "0";
  syncUi();
  const samples = Number(quality.value) || 16, started = performance.now();
  try {
    const blob = await exportMp4(samples, (done, total, label) => {
      bar.style.width = `${(100 * done) / total}%`;
      const el = (performance.now() - started) / 1000, left = done < total ? (el / done) * (total - done) : 0;
      progressText.textContent = done < total ? `${label} · about ${Math.ceil(left)} s left` : label;
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sausage-gazette-explainer.mp4"; a.textContent = `Download sausage-gazette-explainer.mp4 (${(blob.size / 1e6).toFixed(1)} MB)`;
    download.replaceChildren(a); download.hidden = false;
    progressText.textContent = `Done in ${Math.round((performance.now() - started) / 1000)} s.`;
    lastExport = blob;
    a.click();
  } catch (e) {
    progressText.textContent = String((e as Error)?.message ?? e) === "stopped" ? "Stopped." : `Couldn't save the video: ${(e as Error)?.message ?? e}`;
  } finally {
    exporting = false;
    exportBtn.disabled = false; cancelBtn.hidden = true; quality.disabled = false;
    playBtn.disabled = false; scrub.disabled = false;
    dirty = true; syncUi();
  }
}
let lastExport: Blob | null = null;

// ---------------------------------------------------------------- wiring
playBtn.onclick = () => (playing ? pause() : play());
bigPlay.onclick = () => play();
canvas.onclick = () => { if (!exporting && S) (playing ? pause() : play()); };
scrub.oninput = () => seek(Number(scrub.value));
soundBtn.onclick = () => { soundOn = !soundOn; savePref("sound", soundOn); if (soundOn) void startAudio(); else stopAudio(); syncUi(); };
loopBtn.onclick = () => { loop = !loop; savePref("loop", loop); syncUi(); };
exportBtn.onclick = () => void runExport();
cancelBtn.onclick = () => { stopRequested = true; };
document.addEventListener("keydown", (e) => {
  if (exporting || !S) return;
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON") { if (e.key !== " " || tag !== "INPUT") return; }
  if (e.key === " " || e.key === "k") { e.preventDefault(); playing ? pause() : play(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); seek((playing ? clockNow() : t) + 1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); seek((playing ? clockNow() : t) - 1); }
  else if (e.key === "Home") { e.preventDefault(); seek(0); }
});

(async () => {
  try {
    delete G.__gazetteApp;
    G.THREE = THREE;
    await import("../diorama/stage.js");
    await import("../diorama/sound.js");
    await import("../diorama/scene.js");
    style = G.STYLES[G.STYLES.length - 1];
    dur = style.duration;
    scrub.max = String(dur);
    style.beats.forEach((b) => {
      const li = document.createElement("li"), btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `<span class="tag"></span><span class="txt"></span>`;
      (btn.firstChild as HTMLElement).textContent = b.tag;
      (btn.lastChild as HTMLElement).textContent = b.text;
      btn.onclick = () => { seek(b.t0 + 0.01); if (!playing) play(); };
      li.append(btn); beatsEl.append(li);
    });
    S = await G.K.run(canvas, style, { samples: 1, width: W, height: H });
    // first frame: the tile in morning light
    t = 0.0; dirty = true;
    loading.hidden = true;
    playBtn.disabled = false; scrub.disabled = false; exportBtn.disabled = false;
    void getScore();
    syncUi();
    requestAnimationFrame(frame);
    // for scripted renders (diorama-wip/render.mjs)
    G.__explainer = {
      ready: true,
      exportMp4: async (samples = 16) => {
        const blob = await exportMp4(samples, () => {});
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      },
      last: () => lastExport,
    };
  } catch (e) {
    console.error(e);
    loading.textContent = `The town couldn't be built: ${(e as Error)?.message ?? e}`;
  }
})();
