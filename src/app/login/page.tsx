"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign-in / onboarding entry. Matches the design's "Set up Bursar for your
 * school" screen. Google is the only path (sign-in is required — no offline
 * demo). The plain-benefit copy follows the voice guide: say what it protects,
 * not the mechanism.
 */
export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setError(
        "Couldn't reach Google sign-in. Your records are safe. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 py-10 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 4h9a4 4 0 0 1 0 8H6zM6 12h10a4 4 0 0 1 0 8H6zM6 4v16"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            Bursar
          </span>
        </div>

        <h1 className="font-display text-2xl font-extrabold leading-tight">
          Set up Bursar for your school
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Connect a Google account and every student record and receipt is
          backed up automatically — so nothing is lost if this phone is lost or
          changed.
        </p>

        {error && (
          <p className="mt-5 rounded-lg border-l-4 border-warning bg-warning/15 px-4 py-3 text-sm text-white">
            {error}
          </p>
        )}

        <button
          onClick={connectGoogle}
          disabled={busy}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-ink transition hover:bg-white/90 disabled:opacity-60"
        >
          <GoogleGlyph />
          {busy ? "Connecting…" : "Connect Google account"}
        </button>

        <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/50">
          Bursar keeps your school&apos;s records private. Only you and staff you
          invite can see them.
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
