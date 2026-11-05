"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { apiFetch } from "@/lib/client/api";
import { isTerminalStage, type RunEvent } from "@/lib/types";

export type StreamStatus = "connecting" | "live" | "closed";

// callers key by runId, so a new run starts with an empty log
export function useRunStream(runId: string | null, onTerminal?: () => void) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const handleTerminal = useEffectEvent(() => onTerminal?.());

  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();

    fetchEventSource(`/api/runs/${runId}/events`, {
      signal: controller.signal,
      fetch: apiFetch, // same bearer token and silent refresh as every other request
      openWhenHidden: true,
      async onopen(res) {
        if (!res.ok) throw new Error(`Stream refused with ${res.status}`);
        setStatus("live");
      },
      onmessage(message) {
        const event = JSON.parse(message.data) as RunEvent;
        setEvents((prev) => [...prev, event]);
        if (isTerminalStage(event.stage)) handleTerminal();
      },
      onclose() {
        setStatus("closed");
      },
      onerror(err) {
        throw err; // a retry would replay the log from the start
      },
    }).catch(() => setStatus("closed"));

    return () => controller.abort();
  }, [runId]);

  return { events, status };
}
