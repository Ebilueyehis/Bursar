import { requirePlatformAdmin } from "./guard";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformSchoolRow {
  id: string;
  name: string;
  code: string;
  onboardedOn: string; // ISO date/timestamp
  activeStudents: number;
  lastPaymentAt: string | null; // ISO timestamp, or null if no payments yet
}

/**
 * Every school on the platform with basic metrics, for the operator-only
 * admin panel. Read-only. Throws unless the caller is a platform admin.
 * See docs/superpowers/specs/2026-08-25-platform-admin-panel-design.md.
 */
export async function listSchoolsForAdmin(): Promise<PlatformSchoolRow[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data: schools, error: schoolsErr } = await admin
    .from("schools")
    .select("id, name, code, created_at")
    .order("created_at", { ascending: false });
  if (schoolsErr) throw new Error(schoolsErr.message);

  const { data: studentCounts } = await admin
    .from("students")
    .select("school_id")
    .eq("status", "active");
  const { data: lastPayments } = await admin
    .from("payments")
    .select("school_id, created_at");

  const activeCountBySchool = new Map<string, number>();
  for (const row of studentCounts ?? []) {
    activeCountBySchool.set(
      row.school_id,
      (activeCountBySchool.get(row.school_id) ?? 0) + 1,
    );
  }
  const lastPaymentBySchool = new Map<string, string>();
  for (const row of lastPayments ?? []) {
    const current = lastPaymentBySchool.get(row.school_id);
    if (!current || row.created_at > current) {
      lastPaymentBySchool.set(row.school_id, row.created_at);
    }
  }

  return (schools ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    onboardedOn: s.created_at,
    activeStudents: activeCountBySchool.get(s.id) ?? 0,
    lastPaymentAt: lastPaymentBySchool.get(s.id) ?? null,
  }));
}
