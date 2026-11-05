export const dynamic = "force-dynamic";

import { error, withAuth } from "@/lib/server/http";
import { computeRun, getRunRecord } from "@/lib/server/store";
import { isTerminalStage, type RunEvent } from "@/lib/types";

const TICK_MS = 1_000;

// event n is tick n of the run, so a new connection can replay it from 0
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params;
    const record = getRunRecord(id);
    if (!record) return error(404, "Run not found");

    let seq = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const close = () => {
          clearInterval(timer);
          controller.close();
        };

        const flush = () => {
          const due = Math.floor((Date.now() - record.startedAt) / TICK_MS);
          for (; seq <= due; seq++) {
            const run = computeRun(record, record.startedAt + seq * TICK_MS);
            const { stage, progressPct, message } = run;
            const event: RunEvent = {
              stage,
              progressPct,
              message,
              error: run.stage === "FAILED" ? run.error : undefined,
            };
            controller.enqueue(encoder.encode(`id: ${seq}\ndata: ${JSON.stringify(event)}\n\n`));
            if (isTerminalStage(stage)) return close();
          }
        };

        timer = setInterval(flush, TICK_MS);
        req.signal.addEventListener("abort", () => clearInterval(timer));
        flush();
      },
      cancel() {
        clearInterval(timer);
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        // no-transform stops proxies and next's gzip from buffering the stream
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  });
}
