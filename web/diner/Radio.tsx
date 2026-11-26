// The little counter radio, KDOX 87.9. Click it to open the dial.
// The dial has the three built-in stations, live stations from public/records/stations.json, and the ones you add
// with "Add a station" (paste a station's link; the server finds its stream). Those are kept in UI state.
import { useEffect, useRef, useState } from "react";
import type { FoundStation, LiveStation, UiState } from "../../contract/types";
import { api } from "../api";
import { RadioEngine, loadLiveStations, type Station } from "./radioEngine";

type RadioState = UiState["radio"];
const STATIONS: { id: Station; label: string }[] = [
  { id: "jazz", label: "Jazz" },
  { id: "lofi", label: "Lo-fi" },
  { id: "rain", label: "Rain" },
];

/** Ask the radio to open its dial (the tour uses this). `add` also opens the Add a station form. */
export const RADIO_EVENT = "gazette:radio";
export type RadioEventDetail = { open: boolean; add?: boolean };

const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "station";

interface Props {
  radio: RadioState;
  onChange: (r: RadioState) => void;
  stations: LiveStation[];                       // added from the dial
  onStationsChange: (s: LiveStation[], tuneTo?: RadioState) => void;
}

export function Radio({ radio, onChange, stations, onStationsChange }: Props) {
  const engine = useRef<RadioEngine | null>(null);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false); // audio actually playing (needs a click first)
  const wrap = useRef<HTMLDivElement>(null);
  const [fileStations, setFileStations] = useState<LiveStation[]>([]);
  useEffect(() => { void loadLiveStations().then(setFileStations); }, []);
  const added = useRef(stations);
  added.current = stations;

  const fileIds = new Set(fileStations.map((s) => s.id));
  const dial: { id: Station; label: string; mine?: boolean }[] = [
    ...STATIONS,
    ...fileStations.map((s) => ({ id: `live:${s.id}` as Station, label: s.name })),
    ...stations.filter((s) => !fileIds.has(s.id)).map((s) => ({ id: `live:${s.id}` as Station, label: s.name, mine: true })),
  ];

  // Keep a running engine in sync with saved state; never start one from here.
  useEffect(() => {
    const e = engine.current;
    if (!e?.started) return;
    if (radio.on) { void e.play(radio.station, radio.volume, added.current); setLive(true); }
    else { e.stop(); setLive(false); }
  }, [radio.on, radio.station, radio.volume]);

  useEffect(() => () => engine.current?.dispose(), []);

  // Add a station: link -> found stream -> name it -> on the dial
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState("");
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<FoundStation | null>(null);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (found) nameRef.current?.focus({ preventScroll: true }); }, [found]);
  const resetAdd = () => { setAdding(false); setLink(""); setFound(null); setName(""); setProblem(null); setFinding(false); };

  useEffect(() => {
    const onEvent = (ev: Event) => {
      const d = (ev as CustomEvent<RadioEventDetail>).detail;
      setOpen(d.open);
      if (d.open && d.add) { setAdding(true); window.setTimeout(() => linkRef.current?.focus({ preventScroll: true }), 50); }
      if (!d.open) resetAdd();
    };
    window.addEventListener(RADIO_EVENT, onEvent);
    return () => window.removeEventListener(RADIO_EVENT, onEvent);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      if (wrap.current?.contains(t) || t.closest?.(".gz-tour")) return;   // the tour's own buttons don't close it
      setOpen(false); resetAdd();
    };
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape" && !document.querySelector(".gz-tour")) { setOpen(false); resetAdd(); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const start = (next: RadioState, list = added.current) => {
    engine.current ??= new RadioEngine();
    void engine.current.play(next.station, next.volume, list);
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

  const find = async () => {
    if (!link.trim() || finding) return;
    setFinding(true); setProblem(null); setFound(null);
    try {
      const f = await api.findStation(link.trim());
      setFound(f); setName(f.name);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setFinding(false);
    }
  };

  const save = () => {
    if (!found) return;
    const label = name.trim().slice(0, 40) || found.name;
    const taken = new Set([...stations.map((s) => s.id), ...fileStations.map((s) => s.id)]);
    let id = slug(label), n = 2;
    while (taken.has(id)) id = `${slug(label).slice(0, 29)}-${n++}`;
    const list = [...stations, { id, name: label, url: found.url, cors: found.cors }];
    const next: RadioState = { ...radio, station: `live:${id}`, on: true };
    onStationsChange(list, next);
    start(next, list);   // tune in straight away; this click counts as the gesture audio needs
    resetAdd();
  };

  const remove = (id: Station) => {
    const sid = id.slice(5);
    const list = stations.filter((s) => s.id !== sid);
    if (radio.station === id) {
      const next: RadioState = { ...radio, station: "jazz" };
      if (live) start(next, list);
      onStationsChange(list, next);
    } else onStationsChange(list);
  };

  const status = live ? `On air: ${dial.find((s) => s.id === radio.station)?.label ?? "Jazz"}` : radio.on ? "Tap power to tune in" : "Off";

  return (
    <div className={`radio ${live ? "is-live" : ""}`} ref={wrap}>
      <button type="button" className="radio-set" onClick={() => { setOpen((o) => !o); if (open) resetAdd(); }}
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
        <div className={`radio-dial${adding ? " is-adding" : ""}`} role="group" aria-label="Radio controls">
          <div className="radio-call">KDOX 87.9 <small>{status}</small></div>
          <button type="button" className={`radio-power ${live ? "on" : ""}`} onClick={power} aria-pressed={live}>
            {live ? "Switch off" : "Switch on"}
          </button>
          <div className="radio-stations" role="radiogroup" aria-label="Station">
            {dial.map((s) => (
              <span key={s.id} className={`radio-st${s.id.startsWith("live:") ? " is-live-station" : ""}`}>
                <button type="button" role="radio" aria-checked={radio.station === s.id}
                  className={radio.station === s.id ? "sel" : ""} onClick={() => tune(s.id)}>{s.label}</button>
                {s.mine && (
                  <button type="button" className="radio-remove" onClick={() => remove(s.id)} aria-label={`Remove ${s.label} from the dial`} title="Remove">&times;</button>
                )}
              </span>
            ))}
          </div>
          <label className="radio-vol">
            <span>Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={radio.volume}
              onChange={(e) => onChange({ ...radio, volume: Number(e.target.value) })} />
          </label>

          {!adding ? (
            <button type="button" className="radio-add" onClick={() => { setAdding(true); window.setTimeout(() => linkRef.current?.focus({ preventScroll: true }), 30); }}>
              + Add a station
            </button>
          ) : (
            <form className="radio-addform" onSubmit={(e) => { e.preventDefault(); if (found) save(); else void find(); }}>
              {!found ? (
                <>
                  <label htmlFor="radio-link">Station link</label>
                  <input id="radio-link" ref={linkRef} type="url" inputMode="url" placeholder="Paste its website or stream link"
                    value={link} onChange={(e) => { setLink(e.target.value); setProblem(null); }} disabled={finding} />
                  <p className="radio-hint">Its &ldquo;listen live&rdquo; page works. The Gazette finds the stream.</p>
                  {problem && <p className="radio-problem" role="alert">{problem}</p>}
                  <div className="radio-addrow">
                    <button type="submit" disabled={!link.trim() || finding}>{finding ? "Tuning in…" : "Find it"}</button>
                    <button type="button" onClick={resetAdd}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="radio-found" role="status">Found it. Name it for the dial:</p>
                  <label htmlFor="radio-name" className="radio-sr">Station name</label>
                  <input id="radio-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} ref={nameRef} />
                  <div className="radio-addrow">
                    <button type="submit" className="radio-save">Add &amp; play</button>
                    <button type="button" onClick={() => setFound(null)}>Back</button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
