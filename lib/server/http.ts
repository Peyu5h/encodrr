import { getUserIdFromRequest } from "@/lib/server/auth";
import { z } from "zod";


export function json(data: unknown, init?: number | ResponseInit): Response {
  const responseInit: ResponseInit = typeof init === "number" ? { status: init } : (init ?? {});
  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers: { "content-type": "application/json", ...(responseInit.headers ?? {}) },
  });
}

export function error(status: number, detail: string): Response {
  return json({ detail }, status);
}

/** Returns the authenticated userId, or throws a Response (401) to be caught by the handler. */
export function requireUser(req: Request): string {
  const userId = getUserIdFromRequest(req);
  if (!userId) throw error(401, "Not authenticated");
  return userId;
}

/** Wraps a handler so a thrown Response (e.g. from requireUser) becomes the actual response. */
export async function withAuth(
  req: Request,
  handler: (userId: string) => Promise<Response> | Response,
): Promise<Response> {
  try {
    const userId = requireUser(req);
    return await handler(userId);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T) {
  return schema.safeParse(await req.json().catch(() => null));
}

export function invalid(err: z.ZodError): Response {
  return json({ detail: "Validation failed", fieldErrors: z.flattenError(err).fieldErrors }, 422);
}
