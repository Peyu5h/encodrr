"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { apiFetch } from "@/lib/client/api";
import { isTerminalStage, type RunEvent } from "@/lib/types";

export type StreamStatus = "connecting" | "live" | "reconnecting" | "closed";

// thrown to stop fetch-event-source from retrying
class FatalStreamError extends Error { }

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
      openWhenHidden: true,
      async onopen(res) {
        if (!res.ok) throw new FatalStreamError(`Stream refused with ${res.status}`);
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
      onerror(err) {
        if (err instanceof FatalStreamError) throw err;
        setStatus("reconnecting");
      },
    }).catch(() => setStatus("closed"));

    return () => controller.abort();
  }, [runId]);

  return { events, status };
}
