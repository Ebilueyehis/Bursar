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
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[#16212e] text-white">
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
        <span className="font-display text-lg font-extrabold tracking-tight text-ink">
          Bursar
        </span>
      </div>

      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-warning">
        First-time setup · Step 1 of 1
      </p>
      <h1 className="font-display text-2xl font-extrabold text-ink">
        Tell us about your school
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        This creates your school in Bursar and makes you its Proprietor. You can
        invite staff and add students next.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <OnboardingForm defaultName={defaultName} />
      </div>

      <p className="mt-5 text-center text-xs text-ink-faint">
        Your records stay private to you and the staff you invite.
      </p>
    </div>
  );
}
