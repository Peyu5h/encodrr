# Encodr

A small transcoding dashboard: create a job from a media URL, start an encode, watch it run live, and see
the renditions when it finishes. Requirements are in `BRIEF.md`.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run test:run
npm run typecheck
```

Node 20+. Login: `demo@encodr.dev` / `password123`.

The e2e test needs a browser once: `npx playwright install chromium`, then `npm run test:e2e`.

Under the URL field are two samples. `intro.mp4` finishes in about 30s, and `corrupt.mp4` fails halfway so
you can see the error and the retry.

## How it works

**SSE auth.** The stream sends the same `Authorization: Bearer` header as every other request. I open it
with `fetch-event-source` and pass `apiFetch` as its `fetch`, so a reconnect gets the token refresh too.
A query-string token would end up in logs, and a cookie would mean a second auth mechanism.

**Refresh and retry.** `apiFetch` adds the access token. On a 401 it refreshes once and replays the request
once. Requests that fail at the same time wait on the same refresh instead of each starting their own. If
the refresh fails, the tokens are cleared and you go back to `/signin`. Access tokens last 60s and are
HMAC-signed with `node:crypto`, so no extra dependency.

**Runs.** `computeRun` works out a run's state from the time since it started, so there are no timers to
manage. `EncodeRun` is a discriminated union, so a `result` only exists on a completed run and an `error`
only on a failed one. A job's status comes from its latest run.

**Stream.** One event per second, numbered from the start of the run. A new connection replays the whole
log, and a reconnect resumes from `Last-Event-ID`. The timer is cleared when the run ends or the client
leaves.

## Tests

A few focused ones: the run timeline and the corrupt source, token expiry, the URL rules, one refresh for
several 401s, the stream resuming and cleaning up, and server errors landing on the right form field. One
Playwright test covers the happy path.

The optional stretch goals are all in: shared refresh, SSE resume, optimistic create with rollback, and
the Playwright test.

## Assumptions

- One hard-coded user, so jobs aren't per user.
- A valid source is an http(s) URL on a real domain that ends in a media extension (`.mp4`, `.mov`, `.m3u8`…).
- Only `https://cdn.example.com/videos/corrupt.mp4` fails, and it always does.
- Light theme only, since theming was out of scope.

## With more time

- Keep the refresh token in an httpOnly cookie and rotate it.
- Use a database and a job queue instead of in-memory state.
- Let users cancel an encode, and add an e2e for the failure path.
