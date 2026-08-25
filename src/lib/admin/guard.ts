import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Throws unless the signed-in caller is on the platform_admins allowlist.
 * Every platform-admin server action or page must call this first, before
 * touching the admin client for anything else. See
 * docs/superpowers/specs/2026-08-25-platform-admin-panel-design.md.
 */
export async function requirePlatformAdmin(): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Not authorised.");

  return { id: user.id };
}
