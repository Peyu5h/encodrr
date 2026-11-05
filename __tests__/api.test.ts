import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, AUTH_LOGOUT_EVENT } from "@/lib/client/api";
import { clearTokens, getAccessToken, setTokens } from "@/lib/client/token-store";

// protected routes only accept "fresh"; the refresh endpoint answers after a short delay
function mockServer({ refreshWorks }: { refreshWorks: boolean }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (input === "/api/auth/refresh") {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return refreshWorks
        ? Response.json({ accessToken: "fresh" })
        : Response.json({ detail: "Session expired" }, { status: 401 });
    }
    const authorized = new Headers(init?.headers).get("authorization") === "Bearer fresh";
    return authorized ? Response.json([]) : Response.json({ detail: "Not authenticated" }, { status: 401 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("api client auth", () => {
  beforeEach(() => {
    setTokens({ accessToken: "stale", refreshToken: "refresh" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearTokens();
  });

  it("shares one refresh between concurrent 401s and retries each request once", async () => {
    const fetchMock = mockServer({ refreshWorks: true });

    const results = await Promise.all([
      api.get("/api/jobs"),
      api.get("/api/jobs/j_1"),
      api.get("/api/runs/r_1"),
    ]);

    expect(results).toEqual([[], [], []]);
    const refreshes = fetchMock.mock.calls.filter(([input]) => input === "/api/auth/refresh");
    expect(refreshes).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(7); // 3 originals, 1 refresh, 3 retries
    expect(getAccessToken()).toBe("fresh");
  });

  it("clears the session and signals logout when the refresh is rejected", async () => {
    mockServer({ refreshWorks: false });
    const onLogout = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);

    await expect(api.get("/api/jobs")).rejects.toMatchObject({ status: 401 });
    expect(onLogout).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBeNull();

    window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  });
});
