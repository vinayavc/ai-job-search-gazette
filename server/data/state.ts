import { join } from "node:path";
import type { UiState } from "../../contract/types";
import { atomicWrite, readText } from "./util";

const STATIONS = ["jazz", "lofi", "rain"] as const;

export function defaultState(): UiState {
  return { circled: [], autoRank: true, radio: { station: "jazz", volume: 0.4, on: false } };
}

export function statePath(repoRoot: string): string {
  return join(repoRoot, "ui", ".state", "state.json");
}

export class StateError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

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
  if (isObj(doc.radio)) {
    const r = doc.radio;
    if (typeof r.station === "string" && (STATIONS as readonly string[]).includes(r.station)) s.radio.station = r.station as UiState["radio"]["station"];
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
  if ("radio" in patch) {
    const r = patch.radio;
    if (!isObj(r)) throw new StateError("radio must be an object");
    if ("station" in r) {
      if (typeof r.station !== "string" || !(STATIONS as readonly string[]).includes(r.station)) throw new StateError(`radio.station must be one of ${STATIONS.join(", ")}`);
      next.radio.station = r.station as UiState["radio"]["station"];
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
