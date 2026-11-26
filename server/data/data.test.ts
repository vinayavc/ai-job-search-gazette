import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFixtureRepo } from "./__fixtures__/fixtureRepo";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Application, Edition, Job, UiState } from "../../contract/types";
import { parseCsv } from "./csv";
import { buildEdition } from "./edition";
import { checkFilePath } from "./files";
import { dataRoutes } from "./index";
import { loadJobs, mapJob } from "./jobs";
import { loadProfile } from "./profile";
import { sanitizeNote } from "./markSent";
import { mergeState, defaultState } from "./state";
import { parseTracker } from "./tracker";
import { norm, normUrl, folderName } from "./util";

const NOW = new Date(2026, 0, 15, 12, 0, 0); // local 2026-01-15
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gazette-data-"));
  writeFixtureRepo(root);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const routes = () => dataRoutes(root, { now: () => NOW });
const call = async (key: string, init?: RequestInit & { url?: string }, params: Record<string, string> = {}) => {
  const req = new Request(init?.url ?? "http://x/", init);
  return routes()[key](req, params);
};
const tracker = () => readFileSync(join(root, "job_search_tracker.csv"), "utf8");
const markSent = (jobKey: string) =>
  call("POST /api/applications/mark-sent", { method: "POST", body: JSON.stringify({ jobKey }), headers: { "content-type": "application/json" } });

describe("helpers", () => {
  test("norm matches rank_state.norm semantics", () => {
    expect(norm("Bratwurst Bytes, Inc.")).toBe("bratwurstbytesinc");
    expect(norm("Full-Stack  Developer")).toBe("fullstackdeveloper");
    expect(norm(null)).toBe("");
  });
  test("normUrl strips query, fragment, trailing slash", () => {
    expect(normUrl("https://Jobs.Example.test/a/1/?x=1#y")).toBe("https://jobs.example.test/a/1");
  });
  test("folderName follows documents/README subfolder rule", () => {
    expect(folderName("Wurst A/S", "Senior  Engineer (Backend)")).toBe("wurst_as_senior_engineer_backend");
  });
});

describe("jobs mapping", () => {
  test("maps snake_case fields", () => {
    const j = loadJobs(root).find((x) => x.key === "wiggle_backend")!;
    expect(j).toMatchObject({
      title: "Backend Engineer", company: "Wigglebottom Labs", location: "Exampleville", portal: "fakeportal",
      firstSeen: "2026-01-02", postedDate: "2026-01-01", deadline: null, scrapeFit: "high", status: "ranked",
      rankScore: 82, rankVerdict: "Strong Fit", rankDate: "2026-01-02", locationVerdict: "PASS", languageGate: "PASS",
      strengths: ["Java", "AWS"], gaps: ["Go"], guard: "clean", applicants: 12, vetoed: false, flagged: false,
    });
  });
  test("legacy PASS/FAIL/FLAG in location becomes the location verdict", () => {
    const j = loadJobs(root).find((x) => x.key === "frank_platform")!;
    expect(j.locationVerdict).toBe("FAIL");
    expect(j.location).toBeNull();
    expect(j.vetoed).toBe(true);
    expect(j.scrapeFit).toBe("medium");
  });
  test("explicit location_verdict wins over legacy location", () => {
    const j = mapJob("k", { location: "FAIL", location_verdict: "PASS" });
    expect(j.locationVerdict).toBe("PASS");
  });
  test("vetoed / flagged derivation", () => {
    const by = Object.fromEntries(loadJobs(root).map((j) => [j.key, j]));
    expect(by.bytes_fullstack.flagged).toBe(true);   // language FLAG
    expect(by.bytes_fullstack.vetoed).toBe(false);
    expect(by.bytes_fullstack.applicants).toBe("200+");
    expect(by.pretzel_sre.vetoed).toBe(true);        // language FAIL
    expect(by.pretzel_sre.flagged).toBe(true);       // FLAG + guard
    expect(mapJob("g", { guard: "odd" }).flagged).toBe(true);
    expect(mapJob("g", { guard: "clean" }).flagged).toBe(false);
    expect(by.mustard_data.rankScore).toBeNull();
    expect(by.mustard_data.strengths).toEqual([]);
  });
  test("isFresh = newest firstSeen", () => {
    const fresh = loadJobs(root).filter((j) => j.isFresh).map((j) => j.key).sort();
    expect(fresh).toEqual(["bytes_fullstack", "pretzel_sre", "wiggle_backend"]);
  });
  test("falls back to the skill-local seen_jobs.json, then empty", () => {
    const alt = join(root, ".claude/skills/job-scraper/job_scraper");
    mkdirSync(alt, { recursive: true });
    cpSync(join(root, "job_scraper/seen_jobs.json"), join(alt, "seen_jobs.json"));
    rmSync(join(root, "job_scraper"), { recursive: true });
    expect(loadJobs(root).length).toBe(6);
    rmSync(join(root, ".claude"), { recursive: true });
    expect(loadJobs(root)).toEqual([]);
  });
  test("invalid JSON returns the last good parse", () => {
    expect(loadJobs(root).length).toBe(6);
    writeFileSync(join(root, "job_scraper/seen_jobs.json"), '{"seen": {"half');
    expect(loadJobs(root).length).toBe(6);
  });
});

describe("tracker", () => {
  test("RFC 4180 quoting", () => {
    const recs = parseCsv('a,"b,c","d ""e""","multi\nline"\r\nx,y,,z\n');
    expect(recs.map((r) => r.fields.map((f) => f.value))).toEqual([
      ["a", "b,c", 'd "e"', "multi\nline"],
      ["x", "y", "", "z"],
    ]);
    expect(recs[0].eol).toBe("\r\n");
  });
  test("applications parse with quoted fields, final status and docs", () => {
    const e = buildEdition(root, NOW);
    expect(e.applications.length).toBe(4);
    const [wiggle, bytes, old, frank] = e.applications;
    expect(bytes.company).toBe("Bratwurst Bytes, Inc.");
    expect(bytes.notes).toBe('Remote, async; ask about "on-call"');
    expect(bytes.source).toBe("https://jobs.example.test/bytes/7");
    expect(old.isFinal).toBe(true); // legacy "no response"
    expect(wiggle.isFinal).toBe(false);
    expect(wiggle.docs).toEqual({
      cvPdf: "cv/Resume_Wigglebottom_Backend.pdf",
      coverLetterPdf: null, // .tex exists, no pdf
      folder: "documents/applications/wigglebottom_labs_backend_engineer",
      interviewPrep: [
        "documents/applications/wigglebottom_labs_backend_engineer/company_research.md",
        "documents/applications/wigglebottom_labs_backend_engineer/interview_prep.md",
      ],
      outcome: "documents/applications/wigglebottom_labs_backend_engineer/outcome.md",
    });
    expect(frank.docs.folder).toBeNull();
  });
  test("overflowing unquoted commas fold into notes", () => {
    const t = parseTracker("date,company,status,notes,cv_file\n2026-01-01,Acme,applied,one, two, three,cv/a.tex\n");
    expect(t.rows[0].get("notes")).toBe("one, two, three");
    expect(t.rows[0].get("cv_file")).toBe("cv/a.tex");
  });
  test("missing tracker -> []", () => {
    unlinkSync(join(root, "job_search_tracker.csv"));
    expect(buildEdition(root, NOW).applications).toEqual([]);
  });
});

describe("job <-> application matching", () => {
  test("URL (ignoring slash/query/fragment), then company+title", () => {
    const e = buildEdition(root, NOW);
    const by = Object.fromEntries(e.jobs.map((j) => [j.key, j]));
    expect(by.wiggle_backend.application?.rowIndex).toBe(0);   // trailing slash
    expect(by.bytes_fullstack.application?.rowIndex).toBe(1);  // query+fragment, company differs
    expect(by.frank_platform.application?.rowIndex).toBe(3);   // url differs -> company+title
    expect(by.mustard_data.application).toBeNull();
    expect(e.applications[2].jobKey).toBeNull();
    expect(e.applications[0].jobKey).toBe("wiggle_backend");
  });
  test("edition number = distinct first_seen dates", () => {
    expect(buildEdition(root, NOW).editionNumber).toBe(3);
  });
});

describe("profile", () => {
  test("reads name", () => expect(loadProfile(root)).toEqual({ name: "Pat Example", hasProfile: true }));
  test("template placeholder / missing line / missing file", () => {
    const p = join(root, "CLAUDE.md");
    writeFileSync(p, "- **Name:** [YOUR_NAME]\n");
    expect(loadProfile(root).hasProfile).toBe(false);
    writeFileSync(p, "- **Name:** Your Name\n");
    expect(loadProfile(root).hasProfile).toBe(false);
    writeFileSync(p, "- **Name:**   \n- **Location:** x\n");
    expect(loadProfile(root)).toEqual({ name: null, hasProfile: false });
    writeFileSync(p, "# nothing here\n");
    expect(loadProfile(root).hasProfile).toBe(false);
    unlinkSync(p);
    expect(loadProfile(root).hasProfile).toBe(false);
  });
});

describe("mark-sent", () => {
  test("drafted -> applied, date overwritten, note appended, other rows byte-identical", async () => {
    const before = tracker();
    const res = await markSent("wiggle_backend");
    expect(res.status).toBe(200);
    const app = (await res.json()) as Application;
    expect(app.status).toBe("applied");
    expect(app.date).toBe("2026-01-15");
    expect(app.notes).toBe("marked sent via Sausage Gazette 2026-01-15");
    expect(app.jobKey).toBe("wiggle_backend");
    const b = before.split("\n"), a = tracker().split("\n");
    expect(a.length).toBe(b.length);
    expect(a[1]).toBe(
      "2026-01-15,Wigglebottom Labs,Pet tech,Backend Engineer,SDE,portal,applied,,80,marked sent via Sausage Gazette 2026-01-15,cv/Resume_Wigglebottom_Backend.tex,cover_letters/Cover_Wigglebottom_Backend.tex,https://jobs.example.test/wiggle/123,2026-02-10",
    );
    for (const i of [0, 2, 3, 4, 5]) expect(a[i]).toBe(b[i]);
  });
  test("existing notes get '; ' separator", async () => {
    await markSent("frank_platform");
    const line = tracker().split("\n")[4];
    expect(line).toBe("2026-01-15,Frankfurter Systems,Infra,Platform Engineer,SDE,portal,applied,,55,draft only; marked sent via Sausage Gazette 2026-01-15,,,https://elsewhere.example.test/frank-post,");
  });
  test("already applied -> unchanged", async () => {
    const before = tracker();
    const res = await markSent("bytes_fullstack");
    expect(res.status).toBe(200);
    expect(((await res.json()) as Application).status).toBe("applied");
    expect(tracker()).toBe(before);
  });
  test("no row -> append", async () => {
    const before = tracker();
    const res = await markSent("sauerkraut_qa");
    const app = (await res.json()) as Application;
    expect(app).toMatchObject({ rowIndex: 4, status: "applied", company: "Sauerkraut Soft", role: "QA Engineer", date: "2026-01-15", source: "https://jobs.example.test/kraut/2", jobKey: "sauerkraut_qa" });
    expect(tracker()).toBe(before + "2026-01-15,Sauerkraut Soft,,QA Engineer,,,applied,,,,,,https://jobs.example.test/kraut/2,\n");
  });
  test("no tracker -> created with header", async () => {
    unlinkSync(join(root, "job_search_tracker.csv"));
    await markSent("mustard_data");
    expect(tracker()).toBe(
      "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline\n" +
      "2026-01-15,Mustard Analytics,,Data Engineer,,,applied,,,,,,https://jobs.example.test/mustard/5,\n",
    );
  });
  test("CRLF and missing trailing newline are preserved", async () => {
    const p = join(root, "job_search_tracker.csv");
    const crlf = tracker().trimEnd().split("\n").join("\r\n"); // no trailing newline
    writeFileSync(p, crlf);
    await markSent("wiggle_backend");
    const after = tracker();
    expect(after.endsWith("\r\n")).toBe(false);
    expect(after.split("\r\n").length).toBe(5);
    expect(after.includes("\n") && !after.replace(/\r\n/g, "").includes("\n")).toBe(true);
    await markSent("sauerkraut_qa");
    const after2 = tracker();
    expect(after2.startsWith(after + "\r\n")).toBe(true);
    expect(after2.endsWith("\r\n")).toBe(false);
  });
  test("unknown key -> 404, bad body -> 400", async () => {
    expect((await markSent("nope")).status).toBe(404);
    expect((await call("POST /api/applications/mark-sent", { method: "POST", body: "{}" })).status).toBe(400);
  });
  test("notes are sanitised", () => {
    expect(sanitizeNote('a, "b"\nc')).toBe("a - 'b' c");
  });
});

describe("files", () => {
  const get = (path: string) => call("GET /api/files", { url: "http://x/api/files?path=" + encodeURIComponent(path) });
  test("serves allowed files with content types", async () => {
    let r = await get("cv/Resume_Wigglebottom_Backend.pdf");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    r = await get("documents/applications/wigglebottom_labs_backend_engineer/interview_prep.md");
    expect(r.headers.get("content-type")).toStartWith("text/markdown");
    expect(await r.text()).toBe("# Interview prep\n");
    r = await get("cover_letters/Cover_Wigglebottom_Backend.tex");
    expect(r.headers.get("content-type")).toStartWith("text/x-tex");
    r = await get("documents/applications/wigglebottom_labs_backend_engineer/posting.txt");
    expect(r.headers.get("content-type")).toStartWith("text/plain");
  });
  test("rejects bad paths", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("/etc/passwd")).status).toBe(400);
    expect((await get("cv/../CLAUDE.md")).status).toBe(400);
    expect((await get("CLAUDE.md")).status).toBe(403);
    expect((await get("job_scraper/seen_jobs.json")).status).toBe(403);
    expect((await get("cv/missing.pdf")).status).toBe(404);
    expect((await get("cv/x.exe")).status).toBe(415);
  });
  test("rejects symlinks escaping the repo", () => {
    const outside = mkdtempSync(join(tmpdir(), "gazette-outside-"));
    writeFileSync(join(outside, "secret.md"), "nope");
    symlinkSync(join(outside, "secret.md"), join(root, "cv", "link.md"));
    const c = checkFilePath(root, "cv/link.md");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.status).toBe(403);
    rmSync(outside, { recursive: true, force: true });
  });
});

describe("state", () => {
  const put = (body: unknown) => call("PUT /api/state", { method: "PUT", body: JSON.stringify(body) });
  test("defaults, merge, persist atomically", async () => {
    expect(await (await call("GET /api/state")).json()).toEqual(defaultState());
    const r = await put({ circled: ["a", "a", "b"], radio: { on: true } });
    expect(r.status).toBe(200);
    const s = (await r.json()) as UiState;
    expect(s).toEqual({ circled: ["a", "b"], autoRank: true, dogName: "Doxie", circlesOpen: true, radio: { station: "jazz", volume: 0.4, on: true } });
    expect(((await (await put({ dogName: "  Zoë " })).json()) as UiState).dogName).toBe("Zoë");
    expect((await put({ dogName: "" })).status).toBe(400);
    expect(((await (await put({ radio: { station: "live:wave983" } })).json()) as UiState).radio.station).toBe("live:wave983");
    await put({ radio: { station: "rain" }, autoRank: false });
    const disk = JSON.parse(readFileSync(join(root, "ui/.state/state.json"), "utf8"));
    expect(disk).toEqual({ circled: ["a", "b"], autoRank: false, dogName: "Zoë", circlesOpen: true, radio: { station: "rain", volume: 0.4, on: true } });
    expect(await (await call("GET /api/state")).json()).toEqual(disk);
  });
  test("validation", async () => {
    expect((await put({ autoRank: "yes" })).status).toBe(400);
    expect((await put({ circlesOpen: "no" })).status).toBe(400);
    expect((await put({ radio: { station: "polka" } })).status).toBe(400);
    expect((await put({ radio: { station: "live:Bad Id" } })).status).toBe(400);
    expect((await put({ radio: { volume: 2 } })).status).toBe(400);
    expect((await put({ circled: [1] })).status).toBe(400);
    expect((await put([1])).status).toBe(400);
    expect(existsSync(join(root, "ui/.state/state.json"))).toBe(false);
    expect(() => mergeState(defaultState(), null)).toThrow();
  });
});

describe("routes", () => {
  test("GET /api/edition and /api/jobs/:key", async () => {
    const e = (await (await call("GET /api/edition")).json()) as Edition;
    expect(e.jobs.length).toBe(6);
    expect(e.profile.name).toBe("Pat Example");
    expect(e.generatedAt).toBe(NOW.toISOString());
    const j = (await (await call("GET /api/jobs/:key", undefined, { key: "wiggle_backend" })).json()) as Job;
    expect(j.application?.status).toBe("drafted");
    expect((await call("GET /api/jobs/:key", undefined, { key: "zzz" })).status).toBe(404);
  });
});
