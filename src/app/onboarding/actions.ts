"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OnboardingResult {
  error?: string;
}

/**
 * Creates a school and makes the signed-in user its Proprietor. Runs with the
 * admin (service_role) client because RLS deliberately forbids a user from
 * inserting their own profile/role — that would be self-escalation. We verify
 * the caller is authenticated and has no profile yet before provisioning.
 */
export async function createSchool(
  _prev: OnboardingResult,
  formData: FormData,
): Promise<OnboardingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const sessionName = String(formData.get("sessionName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!schoolName || !code || !sessionName || !fullName) {
    return { error: "Please fill in every field." };
  }
  if (!/^[A-Z]{2,6}$/.test(code)) {
    return { error: "The short code should be 2–6 letters, e.g. TJH." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "The server isn't fully configured yet (missing service key). Please try again shortly.",
    };
  }

  // Guard: never overwrite an existing membership.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) redirect("/");

  // A first session, dated a Nigerian academic year from today.
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 9);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data: school, error: schoolErr } = await admin
    .from("schools")
    .insert({ name: schoolName, code, current_term: "first" })
    .select("id")
    .single();
  if (schoolErr || !school) {
    return { error: "Couldn't create the school. Please try again." };
  }

  const { data: session, error: sessErr } = await admin
    .from("sessions")
    .insert({
      school_id: school.id,
      name: sessionName,
      start_date: iso(start),
      end_date: iso(end),
    })
    .select("id")
    .single();
  if (sessErr || !session) {
    return { error: "Couldn't set up the session. Please try again." };
  }

  await admin
    .from("schools")
    .update({ current_session_id: session.id })
    .eq("id", school.id);

  const { error: profErr } = await admin.from("profiles").insert({
    id: user.id,
    school_id: school.id,
    full_name: fullName,
    role: "proprietor",
    email: user.email,
  });
  if (profErr) {
    return { error: "Couldn't finish setting up your account. Please try again." };
  }

  redirect("/");
}
