"use client";

import { use } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { jobKeys, useJob, useRun, useStartRun } from "@/lib/client/hooks";
import { useRunStream, type StreamStatus } from "@/lib/client/use-run-stream";
import { ACTIVE_STAGES, type EncodeResult, type RunEvent } from "@/lib/types";
import { Button } from "@/components/button";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const jobQuery = useJob(id);
  const startRun = useStartRun(id);

  if (jobQuery.isLoading)
    return <p className="text-sm text-neutral-500">Loading job…</p>;
  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="text-sm text-red-600">
        Job not found.{" "}
        <Link href="/jobs" className="underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const job = jobQuery.data;
  const canStart = job.status === "NEW" || job.status === "FAILED";

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-xl font-semibold">
              <Link
                href="/jobs"
                className="text-neutral-400 hover:text-neutral-700"
              >
                Jobs
              </Link>
              <span className="mx-2 text-neutral-300">/</span>
              {job.title}
            </h1>
            <StatusBadge value={job.status} />
          </div>
          <p className="mt-1 truncate text-sm text-neutral-500">
            {job.sourceUrl}
          </p>
          {startRun.isError && (
            <p className="mt-1 text-sm text-red-600">
              {startRun.error.message}
            </p>
          )}
        </div>
        {canStart && (
          <Button
            onClick={() => startRun.mutate()}
            disabled={startRun.isPending}
          >
            {job.status === "FAILED" ? "Retry" : "Start encode"}
          </Button>
        )}
      </div>

      {job.latestRunId ? (
        <RunPanel key={job.latestRunId} runId={job.latestRunId} />
      ) : (
        <p className="grid flex-1 place-items-center rounded-md border border-dashed border-neutral-300 text-sm text-neutral-500">
          Start an encode to watch it run live.
        </p>
      )}
    </div>
  );
}

function RunPanel({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const { events, status } = useRunStream(runId, () =>
    queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  );
  const latest = events.at(-1);
  const completed = latest?.stage === "COMPLETED";
  const run = useRun(runId, { enabled: completed });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RunProgress events={events} />

      {latest?.error && (
        <p
          role="alert"
          className="shrink-0 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span className="font-medium">Encode failed.</span> {latest.error}
        </p>
      )}

      <div
        className={clsx(
          "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-4 md:grid-rows-1",
          completed && "md:grid-cols-[minmax(0,1fr)_18rem]",
        )}
      >
        <EncoderLog events={events} status={status} />
        {run.data?.stage === "COMPLETED" && <Output result={run.data.result} />}
      </div>
    </div>
  );
}

function RunProgress({ events }: { events: RunEvent[] }) {
  const latest = events.at(-1);
  const stage = latest?.stage;
  // the stage that broke is the one right before FAILED
  const reached = stage === "FAILED" ? events.at(-2)?.stage : stage;
  const current =
    stage === "COMPLETED"
      ? ACTIVE_STAGES.length
      : ACTIVE_STAGES.findIndex((name) => name === reached);

  return (
    <section className="shrink-0 space-y-3 rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium capitalize">
          {stage?.toLowerCase() ?? "connecting"}
        </span>
        <span className="tabular-nums text-neutral-500">
          {latest?.progressPct ?? 0}%
        </span>
      </div>
      <ProgressBar
        value={latest?.progressPct ?? 0}
        failed={stage === "FAILED"}
      />
      <ol className="flex flex-wrap gap-x-5 gap-y-1 text-xs capitalize">
        {ACTIVE_STAGES.map((name, i) => (
          <li
            key={name}
            className={clsx(
              i < current && "text-neutral-700",
              i === current &&
                (stage === "FAILED"
                  ? "font-medium text-red-600"
                  : "font-medium text-blue-600"),
              i > current && "text-neutral-400",
            )}
          >
            {name.toLowerCase()}
          </li>
        ))}
      </ol>
    </section>
  );
}

const STREAM_STATUS: Record<StreamStatus, { label: string; dot: string }> = {
  connecting: { label: "Connecting", dot: "bg-amber-400" },
  live: { label: "Live", dot: "animate-pulse bg-emerald-400" },
  reconnecting: { label: "Reconnecting", dot: "animate-pulse bg-amber-400" },
  closed: { label: "Ended", dot: "bg-neutral-500" },
};

function EncoderLog({
  events,
  status,
}: {
  events: RunEvent[];
  status: StreamStatus;
}) {
  const { label, dot } = STREAM_STATUS[status];
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md bg-neutral-950 scheme-dark">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-neutral-400">
        Encoder log
        <span className="flex items-center gap-2">
          <span className={clsx("size-1.5 rounded-full", dot)} />
          {label}
        </span>
      </header>
      {/* column-reverse keeps the newest line in view without scroll code */}
      <div
        role="log"
        aria-label="Encoder log"
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-4 py-3"
      >
        <ol className="font-mono text-xs leading-6 text-neutral-300">
          {events.map((event, i) => (
            <li
              key={i}
              className={clsx(
                "flex gap-4",
                event.stage === "FAILED" && "text-red-400",
                event.stage === "COMPLETED" && "text-emerald-400",
              )}
            >
              <span className="w-9 shrink-0 text-right tabular-nums text-neutral-500">
                {event.progressPct}%
              </span>
              <span className="w-24 shrink-0 text-neutral-500">
                {event.stage.toLowerCase()}
              </span>
              <span className="min-w-0">{event.message}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Output({ result }: { result: EncodeResult }) {
  const minutes = Math.floor(result.durationSec / 60);
  const seconds = result.durationSec % 60;

  return (
    <section className="min-h-0 overflow-y-auto rounded-md border border-neutral-200 bg-white">
      <header className="flex items-baseline justify-between border-b border-neutral-200 px-4 py-2.5 text-sm">
        <h2 className="font-medium">Output</h2>
        <span className="tabular-nums text-neutral-500">
          Duration {minutes}m {seconds}s
        </span>
      </header>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-medium">Rendition</th>
            <th className="py-2 font-medium">Resolution</th>
            <th className="px-4 py-2 text-right font-medium">Size</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 tabular-nums">
          {result.renditions.map((r) => (
            <tr key={r.label}>
              <td className="px-4 py-2 font-medium">{r.label}</td>
              <td className="py-2 text-neutral-600">
                {r.width}×{r.height}
              </td>
              <td className="px-4 py-2 text-right text-neutral-600">
                {r.sizeMb} MB
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.warnings.length > 0 && (
        <ul className="m-4 space-y-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
