import { loginSchema } from "@/lib/schemas";
import { authenticate, issueTokens } from "@/lib/server/auth";
import { error, invalid, json, parseBody } from "@/lib/server/http";
import type { Session } from "@/lib/types";

export async function POST(req: Request) {
  const body = await parseBody(req, loginSchema);
  if (!body.success) return invalid(body.error);

  const user = authenticate(body.data.email, body.data.password);
  if (!user) return error(401, "Invalid email or password");

  return json({ ...issueTokens(user.id), user } satisfies Session);
}
