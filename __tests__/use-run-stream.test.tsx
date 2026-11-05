import { expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { apiFetch } from "@/lib/client/api";
import { useRunStream } from "@/lib/client/use-run-stream";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(() => new Promise(() => {})),
}));

it("streams through apiFetch and aborts the connection on unmount", () => {
  const { unmount } = renderHook(() => useRunStream("r_1"));
  const options = vi.mocked(fetchEventSource).mock.lastCall![1];

  expect(options.fetch).toBe(apiFetch);
  expect(options.signal?.aborted).toBe(false);
  unmount();
  expect(options.signal?.aborted).toBe(true);
});
