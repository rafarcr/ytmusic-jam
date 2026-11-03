"use client";

import { useEffect, useState } from "react";
import type { PublicRoom } from "@/lib/types";

export function useRoom(code: string) {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "ended">("loading");

  useEffect(() => {
    let stop = false;

    async function pull() {
      const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      if (stop) return;
      if (response.status === 404) {
        setStatus((current) => (current === "ready" ? "ended" : "missing"));
        return;
      }
      if (!response.ok) return;
      setRoom((await response.json()) as PublicRoom);
      setStatus("ready");
    }

    void pull();
    const timer = setInterval(() => void pull(), 2000);
    const source = new EventSource(`/api/rooms/${code}/events`);
    source.addEventListener("room", (event) => {
      if (stop) return;
      setRoom(JSON.parse((event as MessageEvent<string>).data) as PublicRoom);
      setStatus("ready");
    });
    source.addEventListener("ended", () => {
      if (!stop) setStatus("ended");
    });

    return () => {
      stop = true;
      clearInterval(timer);
      source.close();
    };
  }, [code]);

  return { room, status };
}
