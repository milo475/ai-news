"use client";

import { useEffect } from "react";
import { track, type EventData } from "@/lib/analytics";

/**
 * Серверийн хуудаснаас нэг удаагийн event илгээх жижиг гүүр. Юу ч рендэрлэхгүй.
 * Жишээ: <TrackEvent event="model_view" data={{ slug }} />
 */
export function TrackEvent({ event, data }: { event: string; data?: EventData }) {
  const key = JSON.stringify(data ?? null);
  useEffect(() => {
    track(event, key === "null" ? undefined : (JSON.parse(key) as EventData));
  }, [event, key]);
  return null;
}
