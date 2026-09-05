import { listSchoolsForAdmin } from "@/lib/admin/schools";

/**
 * Operator-only, cross-school view. Not linked from anywhere in the app nav
 * (see BARE_ROUTES in components/AppShell.tsx) — reached only by URL, and
 * only useful to whoever is on the platform_admins allowlist. See
 * docs/superpowers/specs/2026-08-25-platform-admin-panel-design.md.
 */
export default async function PlatformAdminPage() {
  let rows;
  try {
    rows = await listSchoolsForAdmin();
  } catch {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <p className="text-ink">Not authorised.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background p-6 md:p-10">
      <h1 className="font-display text-2xl text-ink mb-1">Schools</h1>
      <p className="text-sm text-slate mb-6">
        Every school on the platform. Read-only.
      </p>
      <div className="overflow-x-auto rounded-lg border border-rule">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-slate">
              <th className="px-4 py-2 font-medium">School</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Onboarded</th>
              <th className="px-4 py-2 text-right font-medium">Active students</th>
              <th className="px-4 py-2 font-medium">Last payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate">
                  No schools yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-rule/50 last:border-0">
                  <td className="px-4 py-2 text-ink">{r.name}</td>
                  <td className="px-4 py-2 text-ink">{r.code}</td>
                  <td className="px-4 py-2 text-ink">
                    {new Date(r.onboardedOn).toLocaleDateString()}
                  </td>
                  <td className="tabular px-4 py-2 text-right text-ink">
                    {r.activeStudents}
                  </td>
                  <td className="px-4 py-2 text-ink">
                    {r.lastPaymentAt
                      ? new Date(r.lastPaymentAt).toLocaleDateString()
                      : "No payments yet"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
