"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so Bursar installs to the home screen and opens
 * offline. Registration is deferred until after load so it never competes with
 * first paint on a slow connection.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // avoid caching during dev

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the app still works online without the SW.
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
