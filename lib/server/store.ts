import { randomUUID } from "node:crypto";
import {
  isTerminalStage,
  type ActiveStage,
  type EncodeResult,
  type EncodeRun,
  type Job,
} from "@/lib/types";

// In-memory store. A single Node process in `next dev`, so module-level Maps are fine.
//
// The job/run CRUD below is provided. The interesting part — turning an in-flight run into a
// live stage + progress over ~20–40s — is left for you.

const jobs = new Map<string, Job>();
const runs = new Map<string, RunRecord>();

interface RunRecord {
  id: string;
  jobId: string;
  sourceUrl: string;
  startedAt: number; // epoch ms
}

/** The "magic" source URL that should always fail partway, so reviewers can see error handling. */
export const FAIL_URL = "https://cdn.example.com/videos/corrupt.mp4";

// --- encode run state machine ---

const TIMELINE: { stage: ActiveStage; ms: number; log: string[] }[] = [
  { stage: "QUEUED", ms: 2_000, log: ["job queued", "picked up by encoder"] },
  {
    stage: "DOWNLOADING",
    ms: 6_000,
    log: ["connecting to source", "downloading source", "verifying checksum"],
  },
  { stage: "PROBING", ms: 3_000, log: ["reading container", "found h264 video, aac audio"] },
  {
    stage: "TRANSCODING",
    ms: 14_000,
    log: ["encoding 1080p", "encoding 720p", "encoding 480p", "encoding 360p"],
  },
  {
    stage: "PACKAGING",
    ms: 5_000,
    log: ["writing hls segments", "writing playlists", "uploading renditions"],
  },
];

const TOTAL_MS = TIMELINE.reduce((sum, step) => sum + step.ms, 0);
const FAIL_AT_MS = 17_000; // mid-transcode

const LADDER = [
  { label: "1080p", width: 1920, height: 1080, kbps: 5_000 },
  { label: "720p", width: 1280, height: 720, kbps: 2_800 },
  { label: "480p", width: 854, height: 480, kbps: 1_400 },
  { label: "360p", width: 640, height: 360, kbps: 800 },
];

const percent = (ms: number) => Math.floor((ms / TOTAL_MS) * 100);

// a pure function of time since the run started, so every request and stream agrees
export function computeRun(record: RunRecord, now: number = Date.now()): EncodeRun {
  const run = { id: record.id, jobId: record.jobId };
  const elapsed = Math.max(0, now - record.startedAt);

  if (record.sourceUrl === FAIL_URL && elapsed >= FAIL_AT_MS) {
    return {
      ...run,
      stage: "FAILED",
      progressPct: percent(FAIL_AT_MS),
      message: "decode error, aborting",
      error: "Source file is corrupt: undecodable frame at 00:01:12",
    };
  }

  let offset = elapsed;
  for (const { stage, ms, log } of TIMELINE) {
    if (offset < ms) {
      const message = log[Math.floor((offset / ms) * log.length)];
      return { ...run, stage, progressPct: percent(elapsed), message };
    }
    offset -= ms;
  }

  const result = encodeResult(record.sourceUrl);
  return {
    ...run,
    stage: "COMPLETED",
    progressPct: 100,
    message: `done, ${result.renditions.length} renditions ready`,
    result,
  };
}

// derived from the url, so a source always "encodes" the same way
function encodeResult(sourceUrl: string): EncodeResult {
  const durationSec = 60 + ((sourceUrl.length * 17) % 240);
  return {
    durationSec,
    renditions: LADDER.map(({ kbps, ...rendition }) => {
      const megabytes = (kbps * durationSec) / 8 / 1000;
      return { ...rendition, sizeMb: Math.round(megabytes * 10) / 10 };
    }),
    warnings: sourceUrl.length % 3 === 0 ? ["Variable frame rate detected, normalised to 30 fps"] : [],
  };
}

// --- job/run CRUD (provided) ---
function withStatus(job: Job): Job {
  const run = job.latestRunId ? getRun(job.latestRunId) : null;
  const status = !run ? "NEW" : isTerminalStage(run.stage) ? run.stage : "RUNNING";
  return { ...job, status };
}

export function listJobs(): Job[] {
  return [...jobs.values()].map(withStatus).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id: string): Job | null {
  const job = jobs.get(id);
  return job ? withStatus(job) : null;
}

export function createJob(input: { sourceUrl: string; title?: string }): Job {
  const id = `j_${randomUUID().slice(0, 8)}`;
  const sourceUrl = input.sourceUrl.trim();
  const job: Job = {
    id,
    title: input.title?.trim() || deriveTitle(sourceUrl),
    sourceUrl,
    status: "NEW",
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

function deriveTitle(sourceUrl: string): string {
  try {
    const path = new URL(sourceUrl).pathname.replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "Untitled encode";
  } catch {
    return "Untitled encode";
  }
}

export function startRun(jobId: string): RunRecord | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const record: RunRecord = {
    id: `r_${randomUUID().slice(0, 8)}`,
    jobId,
    sourceUrl: job.sourceUrl,
    startedAt: Date.now(),
  };
  runs.set(record.id, record);
  job.latestRunId = record.id;
  return record;
}

export function getRunRecord(id: string): RunRecord | null {
  return runs.get(id) ?? null;
}

export function getRun(id: string, now: number = Date.now()): EncodeRun | null {
  const record = runs.get(id);
  return record ? computeRun(record, now) : null;
}

export type { RunRecord };
