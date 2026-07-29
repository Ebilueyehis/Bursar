import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

/**
 * First-run setup. Only reachable when signed in without a school yet. Reads
 * the Google display name to pre-fill, so there's one less thing to type.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) redirect("/");

  const defaultName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-warning">
        First-time setup
      </p>
      <h1 className="font-display text-2xl font-extrabold text-ink">
        Tell us about your school
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        This creates your school in Bursar and makes you its Proprietor. You can
        invite staff and add students next.
      </p>
      <OnboardingForm defaultName={defaultName} />
    </div>
  );
}
