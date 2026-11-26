// The little counter radio, KDOX 87.9. Click it to open the dial.
import { useEffect, useRef, useState } from "react";
import type { UiState } from "../../contract/types";
import { RadioEngine, loadLiveStations, type Station } from "./radioEngine";

type RadioState = UiState["radio"];
const STATIONS: { id: Station; label: string }[] = [
  { id: "jazz", label: "Jazz" },
  { id: "lofi", label: "Lo-fi" },
  { id: "rain", label: "Rain" },
];

export function Radio({ radio, onChange }: { radio: RadioState; onChange: (r: RadioState) => void }) {
  const engine = useRef<RadioEngine | null>(null);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false); // audio actually playing (needs a click first)
  const wrap = useRef<HTMLDivElement>(null);
  const [liveStations, setLiveStations] = useState<{ id: Station; label: string }[]>([]);
  useEffect(() => { void loadLiveStations().then((ls) => setLiveStations(ls.map((s) => ({ id: `live:${s.id}` as Station, label: s.name })))); }, []);
  const dial = [...STATIONS, ...liveStations];

  // Keep a running engine in sync with saved state; never start one from here.
  useEffect(() => {
    const e = engine.current;
    if (!e?.started) return;
    if (radio.on) { void e.play(radio.station, radio.volume); setLive(true); }
    else { e.stop(); setLive(false); }
  }, [radio.on, radio.station, radio.volume]);

  useEffect(() => () => engine.current?.dispose(), []);

  useEffect(() => {
    if (!open) return;
    const close = (ev: PointerEvent) => { if (!wrap.current?.contains(ev.target as Node)) setOpen(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const start = (next: RadioState) => {
    engine.current ??= new RadioEngine();
    void engine.current.play(next.station, next.volume);
    setLive(true);
  };

  const power = () => {
    if (live) { engine.current?.stop(); setLive(false); onChange({ ...radio, on: false }); }
    else { const next = { ...radio, on: true }; start(next); onChange(next); }
  };

  const tune = (station: Station) => {
    const next = { ...radio, station, on: true };
    start(next);
    onChange(next);
  };

  const status = live ? `On air: ${dial.find((s) => s.id === radio.station)?.label ?? "Jazz"}` : radio.on ? "Tap power to tune in" : "Off";

  return (
    <div className={`radio ${live ? "is-live" : ""}`} ref={wrap}>
      <button type="button" className="radio-set" onClick={() => setOpen((o) => !o)}
        aria-expanded={open} aria-label={`Radio KDOX 87.9 - ${status}. Open the dial`}>
        <svg viewBox="0 0 64 46" width="100%" aria-hidden="true">
          <path d="M44 12L56 2" stroke="#2a2620" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="56" cy="2" r="1.6" fill="#2a2620" />
          <rect x="3" y="11" width="58" height="32" rx="7" fill="#e9e3d3" stroke="#2a2620" strokeWidth="2" />
          <rect x="3" y="35" width="58" height="8" rx="3" fill="#c0392b" stroke="#2a2620" strokeWidth="2" />
          <g stroke="#2a2620" strokeWidth="1.4" strokeLinecap="round">
            <path d="M9 17v14M13 17v14M17 17v14M21 17v14M25 17v14" />
          </g>
          <rect x="31" y="16" width="24" height="9" rx="2" fill={live ? "#f6d77a" : "#f3ead6"} stroke="#2a2620" strokeWidth="1.4" />
          <text x="43" y="23" textAnchor="middle" fontSize="6.4" fontFamily="'Special Elite', monospace" fill="#2a2620">87.9</text>
          <circle cx="37" cy="30" r="3" fill="#f3ead6" stroke="#2a2620" strokeWidth="1.4" />
          <circle cx="49" cy="30" r="3" fill="#f3ead6" stroke="#2a2620" strokeWidth="1.4" />
          <path d="M8 46v-3M56 46v-3" stroke="#2a2620" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="radio-notes" aria-hidden="true"><i>♪</i><i>♫</i><i>♪</i></span>
      </button>
      {open && (
        <div className="radio-dial" role="group" aria-label="Radio controls">
          <div className="radio-call">KDOX 87.9 <small>{status}</small></div>
          <button type="button" className={`radio-power ${live ? "on" : ""}`} onClick={power} aria-pressed={live}>
            {live ? "Switch off" : "Switch on"}
          </button>
          <div className="radio-stations" role="radiogroup" aria-label="Station">
            {dial.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={radio.station === s.id}
                className={`${radio.station === s.id ? "sel" : ""}${s.id.startsWith("live:") ? " is-live-station" : ""}`}
                onClick={() => tune(s.id)}>{s.label}</button>
            ))}
          </div>
          <label className="radio-vol">
            <span>Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={radio.volume}
              onChange={(e) => onChange({ ...radio, volume: Number(e.target.value) })} />
          </label>
        </div>
      )}
    </div>
  );
}
