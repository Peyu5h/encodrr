// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as streamEvents } from "@/app/api/runs/[id]/events/route";
import { issueTokens } from "@/lib/server/auth";
import { computeRun, createJob, FAIL_URL, startRun } from "@/lib/server/store";
import { ACTIVE_STAGES } from "@/lib/types";

const at = (sourceUrl: string, seconds: number) =>
  computeRun({ id: "r_1", jobId: "j_1", sourceUrl, startedAt: 0 }, seconds * 1000);

describe("encode run", () => {
  it("walks every stage in order, then completes with renditions", () => {
    const runs = Array.from({ length: 31 }, (_, second) =>
      at("https://cdn.example.com/videos/intro.mp4", second),
    );

    expect([...new Set(runs.map((run) => run.stage))]).toEqual([...ACTIVE_STAGES, "COMPLETED"]);
    expect(runs[30]).toMatchObject({ progressPct: 100, result: { renditions: expect.any(Array) } });
  });

  it("fails the corrupt source partway and stays failed", () => {
    expect(at(FAIL_URL, 12).stage).toBe("TRANSCODING");
    expect(at(FAIL_URL, 20)).toMatchObject({ stage: "FAILED", error: expect.stringContaining("corrupt") });
    expect(at(FAIL_URL, 120).stage).toBe("FAILED");
  });
});

describe("run event stream", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function open(runId: string, lastEventId?: string) {
    const headers = new Headers({ authorization: `Bearer ${issueTokens("u_demo").accessToken}` });
    if (lastEventId) headers.set("last-event-id", lastEventId);
    return streamEvents(new Request(`http://test/api/runs/${runId}/events`, { headers }), {
      params: Promise.resolve({ id: runId }),
    });
  }

  it("resumes after the last event id and closes once the run ends", async () => {
    vi.useFakeTimers();
    const run = startRun(createJob({ sourceUrl: "https://cdn.example.com/videos/intro.mp4" }).id)!;
    vi.advanceTimersByTime(45_000);

    const body = await (await open(run.id, "27")).text();
    expect([...body.matchAll(/^id: (\d+)$/gm)].map(([, id]) => id)).toEqual(["28", "29", "30"]);
    expect(body).toContain('"stage":"COMPLETED"');
  });

  it("clears its timer when the client disconnects", async () => {
    vi.useFakeTimers();
    const run = startRun(createJob({ sourceUrl: "https://cdn.example.com/videos/intro.mp4" }).id)!;

    const reader = (await open(run.id)).body!.getReader();
    await reader.read();
    expect(vi.getTimerCount()).toBe(1);

    await reader.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });
});
