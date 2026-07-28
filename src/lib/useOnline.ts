"use client";

import { useEffect, useState } from "react";

/**
 * Tracks connectivity. Bursar's rule is read-offline / write-online, so the UI
 * uses this to show an "Offline" badge and to block money-writing actions with
 * a calm, non-blaming message when there's no connection.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
