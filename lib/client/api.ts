import { getAccessToken, clearTokens, getRefreshToken, setTokens } from "@/lib/client/token-store";

export class ApiError extends Error {
  status: number;
  /** Field-level errors from a 422, keyed by form field name. */
  fieldErrors?: Record<string, string[]>;
  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Fired when auth is unrecoverable. The auth provider listens for this and logs the user out. */
export const AUTH_LOGOUT_EVENT = "encodr:logout";

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText || "Request failed";
  let fieldErrors: Record<string, string[]> | undefined;
  try {
    const body = await res.json();
    if (body?.detail) detail = body.detail;
    if (body?.fieldErrors) {
      fieldErrors = body.fieldErrors;
      detail = "Validation failed";
    }
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, detail, fieldErrors);
}

async function refresh(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: getRefreshToken() }),
  });
  if (!res.ok) return false;
  const { accessToken } = (await res.json()) as { accessToken: string };
  setTokens({ accessToken });
  return true;
}

// concurrent 401s all wait on this one refresh
let refreshing: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  refreshing ??= refresh()
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const send = () => {
    const headers = new Headers(init.headers);
    const access = getAccessToken();
    if (access) headers.set("authorization", `Bearer ${access}`);
    return fetch(input, { ...init, headers });
  };

  const res = await send();
  if (res.status !== 401 || !getRefreshToken()) return res;
  if (await refreshOnce()) return send();

  clearTokens();
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  return res;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const res = await apiFetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });


  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
};
