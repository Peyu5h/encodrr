// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { getUserIdFromRequest, issueTokens } from "@/lib/server/auth";

const bearer = (token: string) =>
  new Request("http://test/api/jobs", { headers: { authorization: `Bearer ${token}` } });

afterEach(() => {
  vi.useRealTimers();
});

it("accepts an access token until it expires", () => {
  vi.useFakeTimers();
  const { accessToken } = issueTokens("u_demo");
  expect(getUserIdFromRequest(bearer(accessToken))).toBe("u_demo");

  vi.advanceTimersByTime(61_000);
  expect(getUserIdFromRequest(bearer(accessToken))).toBeNull();
});

it("rejects a refresh token or tampered claims in place of an access token", () => {
  const { accessToken, refreshToken } = issueTokens("u_demo");
  const [, signature] = accessToken.split(".");
  const claims = { sub: "u_admin", kind: "access", exp: Date.now() + 60_000 };
  const forged = `${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;

  expect(getUserIdFromRequest(bearer(refreshToken))).toBeNull();
  expect(getUserIdFromRequest(bearer(forged))).toBeNull();
});
