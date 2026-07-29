import { createClient } from "@supabase/supabase-js";

/**
 * Admin client — uses the service_role key and BYPASSES Row-Level Security.
 * SERVER-ONLY. Use it exclusively for privileged provisioning that RLS
 * deliberately forbids from the client:
 *   - creating a school + the first proprietor profile on sign-up,
 *   - accepting staff invites,
 *   - approving a parent-submitted registration into a real student record.
 *
 * Guard rails: this module must never be imported into a Client Component, and
 * the key is read from a non-public env var so it can never reach the browser.
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
