// SOUND kit for the Tiny Diorama styles. A style's `sound(k)` writes its score with this kit; K.renderScore(style)
// renders it offline into one AudioBuffer, so playback and the MP4 export hear exactly the same thing.
//
// Everything is synthesised (no samples) and deterministic: noise comes from a seeded generator, never Math.random.
//
//   k.play(name, t, opts)        a named one-shot: tock, click, pop, thud, paper, slap, roller, swish, whoosh, blip,
//                                ding, bell, stamp, stroke, typing, typebar, success
//   k.tone(t, opts)              an oscillator; opts.f is a number, a note ('A5') or [[dt, hz], ...] glide points
//   k.noise(t, opts)             filtered white / pink / brown noise
//   k.bed(name, t0, t1, opts)    an ambience bed ('room')
//   k.music(name, t0, t1, opts)  backing music ('pad': soft chords and a quiet plucked arpeggio)
//   k.withMinor(fn)              plays whatever fn schedules a little quieter (secondary detail)
//
// Common opts: gain (0..1), pan (-1..1), dur (s), f (Hz or note name).
(function (root) {
  const K = root.K || (root.K = {});

  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const hz = (n) => {
    if (typeof n === 'number') return n;
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(String(n));
    if (!m) return 440;
    const midi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  };
  K.hz = hz;

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  function makeNoise(ctx, color, seconds = 4) {
    const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    const r = seeded(color === 'white' ? 7 : color === 'pink' ? 11 : 13);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }

  /** Build the score kit on an (Offline)AudioContext. Returns k; k.out is the master input. */
  K.soundKit = (ctx, o = {}) => {
    const master = ctx.createGain(); master.gain.value = o.gain ?? 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    const noises = {};
    const noiseBuf = (c) => noises[c] || (noises[c] = makeNoise(ctx, c));
    const jitter = seeded(29);
    let scale = 1;

    // a voice: env gain -> pan -> master; returns the node to feed
    function voice(t, { gain = 0.5, pan = 0, a = 0.004, hold = 0, r = 0.1, curve = 'exp' } = {}) {
      const g = ctx.createGain(), p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      const peak = Math.max(0.0001, gain * scale);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
      if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
      else g.gain.linearRampToValueAtTime(0.0001, t + a + hold + r);
      g.connect(p); p.connect(master);
      return { input: g, end: t + a + hold + r + 0.05 };
    }

    function filterNode(type, f, q = 0.7) {
      const bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q; return bq;
    }

    function tone(t, o = {}) {
      if (t < 0) return;
      const dur = o.dur ?? 0.12, a = o.a ?? 0.004, hold = o.hold ?? 0, r = Math.max(0.01, dur - a - Math.max(0, hold));
      const v = voice(t, { gain: o.gain ?? 0.3, pan: o.pan ?? 0, a, hold: Math.max(0, hold), r, curve: o.curve });
      const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
      if (Array.isArray(o.f)) {
        osc.frequency.setValueAtTime(hz(o.f[0][1]), t + o.f[0][0]);
        for (const [dt, f] of o.f.slice(1)) osc.frequency.linearRampToValueAtTime(hz(f), t + dt);
      } else {
        osc.frequency.setValueAtTime(hz(o.f ?? 440), t);
        if (o.to) osc.frequency.exponentialRampToValueAtTime(hz(o.to), t + (o.glide ?? dur * 0.6));
      }
      if (o.detune) osc.detune.value = o.detune;
      let head = osc;
      if (o.filter) { const bq = filterNode(o.filter, o.f2 ?? 1200, o.q ?? 0.7); head.connect(bq); head = bq; }
      head.connect(v.input);
      osc.start(t); osc.stop(v.end);
    }

    function noise(t, o = {}) {
      if (t < 0) return;
      const dur = o.dur ?? 0.1, a = o.a ?? 0.003, hold = Math.max(0, o.hold ?? 0), r = Math.max(0.01, dur - a - hold);
      const v = voice(t, { gain: o.gain ?? 0.2, pan: o.pan ?? 0, a, hold, r, curve: o.curve });
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(o.color || 'white'); src.loop = true;
      let head = src;
      if (o.filter) {
        const bq = filterNode(o.filter, o.f ?? 1000, o.q ?? 0.7);
        if (o.f2) bq.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
        head.connect(bq); head = bq;
      }
      if (o.flutter) {   // amplitude wobble, e.g. paper handling or a roller
        const am = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
        am.gain.value = 0.55; lfo.frequency.value = o.flutter; depth.gain.value = 0.45;
        lfo.connect(depth); depth.connect(am.gain); lfo.start(t); lfo.stop(v.end);
        head.connect(am); head = am;
      }
      head.connect(v.input);
      src.start(t, (jitter() * 3) % 3); src.stop(v.end);
    }

    const P = {
      tock: (t, o) => { tone(t, { f: o.f ?? 600, to: (o.f ?? 600) * 0.82, dur: 0.07, gain: (o.gain ?? 0.3) * 0.9, type: 'triangle', pan: o.pan }); noise(t, { dur: 0.012, filter: 'highpass', f: 3000, gain: (o.gain ?? 0.3) * 0.25, pan: o.pan }); },
      click: (t, o) => { noise(t, { dur: 0.018, filter: 'highpass', f: 2500, gain: (o.gain ?? 0.4) * 0.6, pan: o.pan }); tone(t, { f: 2200, dur: 0.012, gain: (o.gain ?? 0.4) * 0.2, type: 'square', pan: o.pan }); },
      pop: (t, o) => { const f = o.f ?? 420; tone(t, { f: f * 1.7, to: f, glide: 0.04, dur: 0.1, gain: (o.gain ?? 0.4) * 0.8, pan: o.pan }); },
      thud: (t, o) => { const f = o.f ?? 110; tone(t, { f: f * 1.3, to: f * 0.5, glide: 0.12, dur: 0.22, gain: (o.gain ?? 0.4) * 1.1, pan: o.pan }); noise(t, { dur: 0.08, filter: 'lowpass', f: 500, gain: (o.gain ?? 0.4) * 0.5, pan: o.pan }); },
      paper: (t, o) => { const d = o.dur ?? 0.15; noise(t, { dur: d, a: Math.min(0.02, d / 3), filter: 'bandpass', f: 3200, f2: 2200, q: 0.6, gain: (o.gain ?? 0.3) * 0.7, pan: o.pan, flutter: 38 }); },
      slap: (t, o) => { noise(t, { dur: 0.07, filter: 'bandpass', f: 1300, q: 0.9, gain: (o.gain ?? 0.4) * 0.9, pan: o.pan }); tone(t, { f: 160, to: 80, dur: 0.1, gain: (o.gain ?? 0.4) * 0.5, pan: o.pan }); },
      roller: (t, o) => { const d = o.dur ?? 0.6; noise(t, { dur: d, a: 0.08, hold: d * 0.6, color: 'brown', filter: 'lowpass', f: 520, gain: (o.gain ?? 0.3) * 0.9, pan: o.pan, flutter: 16, curve: 'lin' }); },
      swish: (t, o) => { const d = o.dur ?? 0.25; noise(t, { dur: d, a: d * 0.45, filter: 'bandpass', f: 700, f2: 4200, q: 1.1, gain: (o.gain ?? 0.3) * 0.8, pan: o.pan, curve: 'lin' }); },
      whoosh: (t, o) => { const d = o.dur ?? 0.4; noise(t, { dur: d, a: d * 0.5, color: 'pink', filter: 'bandpass', f: 380, f2: 1900, q: 0.9, gain: (o.gain ?? 0.3) * 1.1, pan: o.pan, curve: 'lin' }); },
      blip: (t, o) => tone(t, { f: o.f ?? 'A5', dur: o.dur ?? 0.09, type: o.type || 'sine', gain: o.gain ?? 0.25, pan: o.pan }),
      ding: (t, o) => { const f = hz(o.f ?? 'C6'); tone(t, { f, dur: 1.1, gain: (o.gain ?? 0.4) * 0.55, pan: o.pan }); tone(t, { f: f * 2.76, dur: 0.5, gain: (o.gain ?? 0.4) * 0.12, pan: o.pan }); tone(t, { f: f * 2, dur: 0.7, gain: (o.gain ?? 0.4) * 0.1, pan: o.pan }); },
      bell: (t, o) => { const f = hz(o.f ?? 'A6'); [[1, 0.5, 0.9], [2.4, 0.18, 0.5], [3.9, 0.08, 0.3]].forEach(([m, g, d]) => tone(t, { f: f * m, dur: d, gain: (o.gain ?? 0.35) * g, pan: o.pan })); },
      stamp: (t, o) => { P.thud(t, { gain: (o.gain ?? 0.4) * 0.9, f: 140, pan: o.pan }); noise(t + 0.004, { dur: 0.05, filter: 'bandpass', f: 900, q: 1.2, gain: (o.gain ?? 0.4) * 0.6, pan: o.pan }); },
      stroke: (t, o) => {   // a felt marker drawing a ring
        const d = o.dur ?? 0.5;
        noise(t, { dur: d, a: 0.05, hold: d * 0.7, filter: 'bandpass', f: 2600, q: 2.2, gain: (o.gain ?? 0.5) * 0.35, pan: o.pan, flutter: 9, curve: 'lin' });
        tone(t + d * 0.2, { f: 1850, to: 2100, dur: d * 0.5, gain: (o.gain ?? 0.5) * 0.025, pan: o.pan });
      },
      typing: (t, o) => {
        const n = o.n ?? 10, rate = o.rate ?? 0.09;
        for (let i = 0; i < n; i++) {
          const ti = t + i * rate + (jitter() - 0.5) * rate * 0.35, g = (o.gain ?? 0.5) * (0.7 + jitter() * 0.3);
          noise(ti, { dur: 0.025, filter: 'bandpass', f: 2400 + jitter() * 900, q: 1.4, gain: g * 0.6, pan: o.pan });
          tone(ti, { f: 900 + jitter() * 250, to: 600, dur: 0.035, type: 'triangle', gain: g * 0.18, pan: o.pan });
        }
      },
      typebar: (t, o) => { noise(t, { dur: 0.04, filter: 'highpass', f: 1800, gain: (o.gain ?? 0.4) * 0.7, pan: o.pan }); tone(t, { f: 1250, dur: 0.06, type: 'square', filter: 'bandpass', f2: 1300, q: 3, gain: (o.gain ?? 0.4) * 0.25, pan: o.pan }); },
      success: (t, o) => { const f = hz(o.f ?? 'C6'); [1, 1.26, 1.5, 2].forEach((m, i) => tone(t + i * 0.09, { f: f * m, dur: 0.6 - i * 0.05, type: 'triangle', gain: (o.gain ?? 0.4) * 0.28, pan: o.pan })); },
    };

    const k = {
      ctx, out: master, hz,
      play(name, t, o = {}) { const fn = P[name]; if (fn) fn(t, o); else console.warn('sound: no preset', name); },
      tone, noise,
      withMinor(fn) { const s = scale; scale = s * 0.55; try { fn(); } finally { scale = s; } },
      bed(name, t0, t1, o = {}) {
        // 'room': a soft, warm air bed under everything
        const d = t1 - t0;
        noise(t0, { dur: d, a: 0.8, hold: d - 1.6, color: 'pink', filter: 'lowpass', f: 700, gain: 0.03 * (o.gain ?? 1), curve: 'lin' });
        noise(t0, { dur: d, a: 1.2, hold: d - 2.4, color: 'brown', filter: 'lowpass', f: 220, gain: 0.05 * (o.gain ?? 1), curve: 'lin' });
      },
      music(name, t0, t1, o = {}) {
        // 'pad': one chord per bar, soft detuned triangles, plus a quiet plucked arpeggio on the eighths
        const beat = 60 / (o.bpm ?? 100), bar = beat * 4, chords = o.chords || [['C4', 'E4', 'G4']], G = o.gain ?? 0.6;
        let i = 0;
        for (let t = t0; t < t1 - 0.05; t += bar, i++) {
          const ch = chords[i % chords.length], d = Math.min(bar + 0.35, t1 - t), last = t + bar >= t1;
          for (const n of ch) for (const det of [-6, 6]) {
            tone(t, { f: n, detune: det, type: 'triangle', dur: d, a: 0.45, hold: Math.max(0, d - (last ? 1.6 : 0.8)), gain: 0.012 * G, filter: 'lowpass', f2: 1100, curve: 'lin' });
          }
          tone(t, { f: hz(ch[0]) / 2, type: 'sine', dur: Math.min(bar, t1 - t), a: 0.05, hold: beat * 2, gain: 0.05 * G });
          for (let e = 0; e < 8; e++) {
            const te = t + e * beat / 2; if (te >= t1 - 0.3) break;
            const n = ch[[0, 2, 1, 3, 2, 1, 3, 2][e] % ch.length];
            tone(te, { f: hz(n) * 2, type: 'sine', dur: 0.32, gain: 0.018 * G * (e % 2 ? 0.7 : 1), pan: e % 2 ? 0.25 : -0.25 });
          }
        }
      },
    };
    return k;
  };

  /** Render a style's whole score offline. Resolves to an AudioBuffer of the style's duration (or null without a score). */
  K.renderScore = async (style, o = {}) => {
    if (!style || typeof style.sound !== 'function') return null;
    const sr = o.sampleRate || 48000, dur = o.duration || style.duration || 6;
    const Ctx = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    const ctx = new Ctx(2, Math.ceil(dur * sr), sr);
    const k = K.soundKit(ctx, o);
    style.sound(k);
    return ctx.startRendering();
  };
})(typeof window !== 'undefined' ? window : globalThis);
