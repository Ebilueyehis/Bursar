import { createClient } from "@supabase/supabase-js";

/**
 * Admin client — uses the service_role key and BYPASSES Row-Level Security.
 * SERVER-ONLY. Use it exclusively for privileged access that RLS
 * deliberately forbids from the client:
 *   - creating a school + the first proprietor profile on sign-up,
 *   - accepting staff invites,
 *   - approving a parent-submitted registration into a real student record,
 *   - the platform admin panel (src/lib/admin/), gated on the
 *     platform_admins allowlist.
 *
 * Guard rails: this module must never be imported into a Client Component,
 * the key is read from a non-public env var so it can never reach the
 * browser, and every caller must gate on something beyond "the caller has a
 * valid session" — see the service-role rule in CLAUDE.md.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (server-only) to enable admin actions.",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
