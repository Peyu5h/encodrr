"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { apiFetch } from "@/lib/client/api";
import { isTerminalStage, type RunEvent } from "@/lib/types";

export type StreamStatus = "connecting" | "live" | "reconnecting" | "closed";

// callers key by runId, so a new run starts with an empty log
export function useRunStream(runId: string | null, onTerminal?: () => void) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const handleTerminal = useEffectEvent(() => onTerminal?.());

  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    let ended = false;

    fetchEventSource(`/api/runs/${runId}/events`, {
      signal: controller.signal,
      fetch: apiFetch, // same bearer token and silent refresh as every other request
      async onopen(res) {
        if (!res.ok) {
          // a refused stream (404, 401 after refresh) isn't worth retrying
          controller.abort();
          return setStatus("closed");
        }
        setStatus("live");
      },
      onmessage(message) {
        const event = JSON.parse(message.data) as RunEvent;
        setEvents((prev) => [...prev, event]);
        if (isTerminalStage(event.stage)) {
          ended = true;
          handleTerminal();
        }
      },
      onclose() {
        // the server only closes after a terminal event, anything else is a drop
        if (!ended) throw new Error("Stream dropped");
        setStatus("closed");
      },
      onerror() {
        setStatus("reconnecting");
      },
    });

    return () => controller.abort();
  }, [runId]);

  return { events, status };
}
