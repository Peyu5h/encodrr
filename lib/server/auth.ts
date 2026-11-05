import type { User } from "@/lib/types";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Mock auth for the exercise — no real identity provider, no database.


// The one hard-coded user. Documented in the README.
const USERS: (User & { password: string })[] = [
  { id: "u_demo", email: "demo@encodr.dev", name: "Demo User", password: "password123" },
];

const SECRET = process.env.AUTH_SECRET ?? randomBytes(32).toString("hex");
const ACCESS_TTL_MS = 60_000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60_000;

type TokenKind = "access" | "refresh";

interface Claims {
  sub: string;
  kind: TokenKind;
  exp: number; // epoch ms
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function mint(sub: string, kind: TokenKind, ttlMs: number): string {
  const claims: Claims = { sub, kind, exp: Date.now() + ttlMs };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verify(token: string, kind: TokenKind): string | null {
  const [payload = "", signature = ""] = token.split(".");
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
  return claims.kind === kind && claims.exp > Date.now() ? claims.sub : null;
}

export function authenticate(email: string, password: string): User | null {
  const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) return null;
  const { password: _pw, ...safe } = user;
  return safe;
}

export function findUser(id: string): User | null {
  const user = USERS.find((u) => u.id === id);
  if (!user) return null;
  const { password: _pw, ...safe } = user;
  return safe;
}

export function issueTokens(userId: string): { accessToken: string; refreshToken: string } {
  return {
    accessToken: issueAccessToken(userId),
    refreshToken: mint(userId, "refresh", REFRESH_TTL_MS),
  };
}

export function issueAccessToken(userId: string): string {
  return mint(userId, "access", ACCESS_TTL_MS);
}

/** Return the authenticated userId from the request, or null. */
export function getUserIdFromRequest(req: Request): string | null {
  const [scheme, token] = (req.headers.get("authorization") ?? "").split(" ");
  return scheme === "Bearer" && token ? verify(token, "access") : null;
}

/** Verify a refresh token and return its subject (userId), or null. */
export function verifyRefreshToken(token: string): string | null {
  return verify(token, "refresh");
}
