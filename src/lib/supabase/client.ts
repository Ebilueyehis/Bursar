import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in the browser (Client Components). Uses the public
 * URL + publishable key — safe to ship to the browser because every table is
 * protected by Row-Level Security. Never import the service_role key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
