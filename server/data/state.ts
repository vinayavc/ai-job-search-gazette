import { join } from "node:path";
import type { LiveStation, UiState } from "../../contract/types";
import { atomicWrite, readText } from "./util";

const STATIONS = ["jazz", "lofi", "rain"] as const;
const LIVE = /^live:[a-z0-9-]{1,40}$/;
const isStation = (v: unknown): v is UiState["radio"]["station"] =>
  typeof v === "string" && ((STATIONS as readonly string[]).includes(v) || LIVE.test(v));

export function defaultState(): UiState {
  return { circled: [], autoRank: true, dogName: "Doxie", circlesOpen: true, tourSeen: false, stations: [], radio: { station: "jazz", volume: 0.4, on: false } };
}

export function statePath(repoRoot: string): string {
  return join(repoRoot, "ui", ".state", "state.json");
}

export class StateError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const MAX_STATIONS = 24;
function asStation(v: unknown): LiveStation | null {
  if (!isObj(v)) return null;
  const { id, name, url, cors } = v;
  if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id)) return null;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 40) return null;
  if (typeof url !== "string" || url.length > 2000 || !/^https?:\/\//i.test(url)) return null;
  if (cors !== undefined && typeof cors !== "boolean") return null;
  return { id, name: name.trim(), url, ...(cors === undefined ? {} : { cors }) };
}

/** Read the stored state; any missing or ill-typed value falls back to its default. */
export function loadState(repoRoot: string): UiState {
  const s = defaultState();
  const text = readText(statePath(repoRoot));
  if (text === null) return s;
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { return s; }
  if (!isObj(doc)) return s;
  if (Array.isArray(doc.circled)) s.circled = [...new Set(doc.circled.filter((x): x is string => typeof x === "string"))];
  if (typeof doc.autoRank === "boolean") s.autoRank = doc.autoRank;
  if (typeof doc.dogName === "string" && doc.dogName.trim()) s.dogName = doc.dogName.trim().slice(0, 24);
  if (typeof doc.circlesOpen === "boolean") s.circlesOpen = doc.circlesOpen;
  if (typeof doc.tourSeen === "boolean") s.tourSeen = doc.tourSeen;
  if (Array.isArray(doc.stations)) s.stations = doc.stations.map(asStation).filter((x): x is LiveStation => !!x).slice(0, MAX_STATIONS);
  if (isObj(doc.radio)) {
    const r = doc.radio;
    if (isStation(r.station)) s.radio.station = r.station;
    if (typeof r.volume === "number" && Number.isFinite(r.volume)) s.radio.volume = Math.min(1, Math.max(0, r.volume));
    if (typeof r.on === "boolean") s.radio.on = r.on;
  }
  return s;
}

/** Validate a Partial<UiState> and merge it (radio shallowly) over the current state. Throws StateError. */
export function mergeState(current: UiState, patch: unknown): UiState {
  if (!isObj(patch)) throw new StateError("body must be a JSON object");
  const next: UiState = { ...current, circled: [...current.circled], radio: { ...current.radio } };
  if ("circled" in patch) {
    const c = patch.circled;
    if (!Array.isArray(c) || !c.every((x) => typeof x === "string")) throw new StateError("circled must be an array of strings");
    next.circled = [...new Set(c as string[])];
  }
  if ("autoRank" in patch) {
    if (typeof patch.autoRank !== "boolean") throw new StateError("autoRank must be a boolean");
    next.autoRank = patch.autoRank;
  }
  if ("dogName" in patch) {
    const n = patch.dogName;
    if (typeof n !== "string" || !n.trim() || n.trim().length > 24) throw new StateError("dogName must be 1-24 characters");
    next.dogName = n.trim();
  }
  if ("circlesOpen" in patch) {
    if (typeof patch.circlesOpen !== "boolean") throw new StateError("circlesOpen must be a boolean");
    next.circlesOpen = patch.circlesOpen;
  }
  if ("tourSeen" in patch) {
    if (typeof patch.tourSeen !== "boolean") throw new StateError("tourSeen must be a boolean");
    next.tourSeen = patch.tourSeen;
  }
  if ("stations" in patch) {
    const list = patch.stations;
    if (!Array.isArray(list) || list.length > MAX_STATIONS) throw new StateError(`stations must be a list of at most ${MAX_STATIONS}`);
    const parsed = list.map(asStation);
    if (parsed.some((x) => !x)) throw new StateError("each station needs an id (a-z, 0-9, -), a name (up to 40 characters) and an http(s) url");
    const ids = new Set<string>();
    next.stations = (parsed as LiveStation[]).filter((st) => !ids.has(st.id) && ids.add(st.id));
  }
  if ("radio" in patch) {
    const r = patch.radio;
    if (!isObj(r)) throw new StateError("radio must be an object");
    if ("station" in r) {
      if (!isStation(r.station)) throw new StateError(`radio.station must be one of ${STATIONS.join(", ")}, or live:<id>`);
      next.radio.station = r.station;
    }
    if ("volume" in r) {
      if (typeof r.volume !== "number" || !Number.isFinite(r.volume) || r.volume < 0 || r.volume > 1) throw new StateError("radio.volume must be a number from 0 to 1");
      next.radio.volume = r.volume;
    }
    if ("on" in r) {
      if (typeof r.on !== "boolean") throw new StateError("radio.on must be a boolean");
      next.radio.on = r.on;
    }
  }
  return next;
}

export function saveState(repoRoot: string, state: UiState): void {
  atomicWrite(statePath(repoRoot), JSON.stringify(state, null, 2) + "\n");
}
