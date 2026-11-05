import { refreshSchema } from "@/lib/schemas";
import { findUser, issueAccessToken, verifyRefreshToken } from "@/lib/server/auth";
import { error, json, parseBody } from "@/lib/server/http";

export async function POST(req: Request) {
  const body = await parseBody(req, refreshSchema);
  const userId = body.success ? verifyRefreshToken(body.data.refreshToken) : null;
  if (!userId || !findUser(userId)) return error(401, "Session expired");

  return json({ accessToken: issueAccessToken(userId) });
}
