import { createJobSchema } from "@/lib/schemas";
import { invalid, json, parseBody, withAuth } from "@/lib/server/http";
import { createJob, listJobs } from "@/lib/server/store";

export async function GET(req: Request) {
  return withAuth(req, () => json(listJobs()));
}

export async function POST(req: Request) {
  return withAuth(req, async () => {
    const body = await parseBody(req, createJobSchema);
    if (!body.success) return invalid(body.error);
    return json(createJob(body.data), 201);
  });
}
