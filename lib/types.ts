// Shared contract types — used by both the Route Handlers (server) and the React app (client).
// Keeping one source of truth for the API shape is deliberate: it's what we look for in the review.

export type JobStatus = "NEW" | "RUNNING" | "COMPLETED" | "FAILED";

export type Stage =
  | "QUEUED"
  | "DOWNLOADING"
  | "PROBING"
  | "TRANSCODING"
  | "PACKAGING"
  | "COMPLETED"
  | "FAILED";

/** Non-terminal stages, in order. The encode run walks these then lands on a terminal stage. */
export const ACTIVE_STAGES: Stage[] = [
  "QUEUED",
  "DOWNLOADING",
  "PROBING",
  "TRANSCODING",
  "PACKAGING",
];

export const TERMINAL_STAGES: Stage[] = ["COMPLETED", "FAILED"];

export type TerminalStage = "COMPLETED" | "FAILED";
export type ActiveStage = Exclude<Stage, TerminalStage>;

export function isTerminalStage(stage: Stage): stage is TerminalStage {
  return TERMINAL_STAGES.includes(stage);
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Job {
  id: string;
  title: string;
  sourceUrl: string;
  status: JobStatus;
  createdAt: string; // ISO
  latestRunId?: string;
}

export interface Rendition {
  label: string; // e.g. "1080p"
  width: number;
  height: number;
  sizeMb: number;
}

export interface EncodeResult {
  durationSec: number;
  renditions: Rendition[];
  warnings: string[];
}

interface RunBase {
  id: string;
  jobId: string;
  progressPct: number; // 0–100
  message: string; // latest encoder log line
}

export type EncodeRun = RunBase &
  (
    | { stage: ActiveStage }
    | { stage: "COMPLETED"; result: EncodeResult }
    | { stage: "FAILED"; error: string }
  );

/** Shape of each Server-Sent Event streamed from /api/runs/:id/events. */
export interface RunEvent {
  stage: Stage;
  progressPct: number;
  message: string;
  error?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}
