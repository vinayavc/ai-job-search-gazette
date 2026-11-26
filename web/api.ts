// Orchestrator-owned typed client for contract/API.md.
import type { Edition, Job, UiState, Run, RunRequest, RunEvent, AnswerRequest, Application, FoundStation } from "../contract/types";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  edition: () => j<Edition>("/api/edition"),
  job: (key: string) => j<Job>(`/api/jobs/${encodeURIComponent(key)}`),
  state: () => j<UiState>("/api/state"),
  saveState: (patch: Partial<UiState>) => j<UiState>("/api/state", { method: "PUT", body: JSON.stringify(patch) }),
  markSent: (jobKey: string) => j<Application>("/api/applications/mark-sent", { method: "POST", body: JSON.stringify({ jobKey }) }),
  fileUrl: (path: string) => `/api/files?path=${encodeURIComponent(path)}`,
  startRun: (r: RunRequest) => j<Run>("/api/runs", { method: "POST", body: JSON.stringify(r) }),
  currentRun: () => j<Run | null>("/api/runs/current"),
  answer: (id: string, a: AnswerRequest) => j<{ ok: true }>(`/api/runs/${id}/answer`, { method: "POST", body: JSON.stringify(a) }),
  cancel: (id: string) => j<Run>(`/api/runs/${id}/cancel`, { method: "POST" }),
  findStation: (url: string) => j<FoundStation>("/api/radio/find", { method: "POST", body: JSON.stringify({ url }) }),
};

export function subscribeRun(id: string, onEvent: (e: RunEvent) => void): () => void {
  const es = new EventSource(`/api/runs/${id}/events`);
  es.onmessage = (m) => onEvent(JSON.parse(m.data) as RunEvent);
  return () => es.close();
}
