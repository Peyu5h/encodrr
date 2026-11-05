import { startRunSchema } from "@/lib/schemas";
import { error, invalid, json, parseBody, withAuth } from "@/lib/server/http";
import { getJob, startRun } from "@/lib/server/store";

export async function POST(req: Request) {
  return withAuth(req, async () => {
    const body = await parseBody(req, startRunSchema);
    if (!body.success) return invalid(body.error);

    const { jobId } = body.data;
    if (getJob(jobId)?.status === "RUNNING") return error(409, "This job is already encoding");

    const run = startRun(jobId);
    return run ? json({ runId: run.id }, 201) : error(404, "Job not found");
  });
}
