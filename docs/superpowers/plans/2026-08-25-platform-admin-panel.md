# Platform admin panel: plan

Spec: `docs/superpowers/specs/2026-08-25-platform-admin-panel-design.md`. Read
that first — this plan assumes its decisions.

Five tasks, each its own commit.

---

## Task 1: schema — the allowlist table

Append to `supabase/schema.sql`, after the `audit_log` / `assessments` block
and before the RLS section, so it reads top-to-bottom as "here are the
tables, here is RLS on all of them":

```sql
-- ---------------------------------------------------------------------------
-- Platform administration: operator-only, cross-school (Bursar v1.2)
-- ---------------------------------------------------------------------------
-- Not a school-scoped table and not reachable through RLS at all — see the
-- design doc. Membership is added by hand via SQL, the same care taken with
-- any row that grants privilege.
create table platform_admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;
-- Deliberately no policy and no grant to anon/authenticated: invisible to
-- every ordinary client request. Readable only via the service-role client,
-- which bypasses RLS. service_role already has full access to new tables via
-- the alter default privileges statement below in this file.
```

Since this repo has no migration runner wired up yet (schema.sql is applied
by hand — check `docs/runbooks/` for how prior schema changes were rolled
out, and follow the same path), apply this against Supabase directly and
confirm with `select * from platform_admins;` as the service role. Then add
yourself:

```sql
insert into platform_admins (id, note)
values ('<your auth.users.id>', 'operator');
```

**Test:** as an ordinary authenticated user (any existing profile), confirm
`select * from platform_admins` returns zero rows or a permission error, not
your row. This is the one security-critical check in this task — verify it
before moving on.

---

## Task 2: the allowlist check, as its own module

New file `src/lib/admin/guard.ts`:

```ts
import "server-only";
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
```

This is the second call site of `createAdminClient()`. Update the comment on
`src/lib/supabase/admin.ts` to list it alongside onboarding, and update
CLAUDE.md's standing rule in the same commit (see Task 5).

**Test:** a unit test that mocks `createClient`/`createAdminClient` and
asserts `requirePlatformAdmin()` throws for a signed-out caller, throws for a
signed-in caller with no `platform_admins` row, and resolves for one with a
row.

---

## Task 3: the cross-school query

New file `src/lib/admin/schools.ts`:

```ts
import "server-only";
import { requirePlatformAdmin } from "./guard";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformSchoolRow {
  id: string;
  name: string;
  code: string;
  onboardedOn: string;      // ISO date
  activeStudents: number;
  lastPaymentAt: string | null; // ISO timestamp, or null if no payments yet
}

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
```

Three round trips rather than one aggregate SQL view: this repo has no
mechanism yet for the admin client to call a hand-written SQL function safely
from the app layer, and the school count is small enough (single digits to
low tens) that the client-side grouping cost is negligible. If school count
grows enough for this to matter, that is the measured moment to add a SQL
view — same reasoning `docs/capacity-and-cost.md` applies elsewhere in this
repo. Note it in `docs/backlog.md` as a deferred optimisation, not a bug.

**Test:** against the mock-data shape (see Task 4), verify a school with zero
students returns `activeStudents: 0` rather than throwing, and a school with
no payments yet returns `lastPaymentAt: null`.

---

## Task 4: the page

New route `src/app/platform-admin/page.tsx`, styled to match the rest of the
app (Paper/Card/Ink Navy tokens from `globals.css`, tabular figures for the
counts). On `requirePlatformAdmin()` throwing, render a plain "Not
authorised" message rather than a stack trace — this page will occasionally
be hit by non-admin users typing the URL, and that is not an error condition
worth alarming over.

```tsx
import { listSchoolsForAdmin } from "@/lib/admin/schools";

export default async function PlatformAdminPage() {
  let rows;
  try {
    rows = await listSchoolsForAdmin();
  } catch {
    return (
      <div className="p-6 text-ink">
        <p>Not authorised.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl text-ink mb-4">Schools</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-rule">
            <th className="py-2">School</th>
            <th className="py-2">Code</th>
            <th className="py-2">Onboarded</th>
            <th className="py-2 text-right tabular-nums">Active students</th>
            <th className="py-2">Last payment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/50">
              <td className="py-2">{r.name}</td>
              <td className="py-2">{r.code}</td>
              <td className="py-2">
                {new Date(r.onboardedOn).toLocaleDateString()}
              </td>
              <td className="py-2 text-right tabular-nums">
                {r.activeStudents}
              </td>
              <td className="py-2">
                {r.lastPaymentAt
                  ? new Date(r.lastPaymentAt).toLocaleDateString()
                  : "No payments yet"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

No link to this route from anywhere in the normal app nav — it is reached
only by URL, deliberately, since there is no role in the product today that
should ever see it in a menu.

**Test:** this is the UI-in-a-browser step from CLAUDE.md's own instructions
("start the dev server and use the feature... before reporting the task as
complete"). Sign in as the platform admin, hit `/platform-admin`, confirm the
table renders; sign in as an ordinary Proprietor/Bursar/Teacher, hit the same
URL, confirm "Not authorised."

---

## Task 5: docs

Same commit as Task 2 (the CLAUDE.md change belongs with the code that makes
it true, not tacked on later):

- `CLAUDE.md`: reword the service-role-key rule. Replace

  > **The service-role key is server-only.** It is imported in exactly one
  > file, `src/app/onboarding/actions.ts`, which is `"use server"`. If a
  > second import site appears, that is a finding, not a convenience.

  with

  > **The service-role key is server-only.** It is read in exactly one
  > module, `src/lib/supabase/admin.ts`. Every file that calls
  > `createAdminClient()` must gate on something beyond "the caller has a
  > valid session" — onboarding gates on "no profile exists yet for this
  > user", platform-admin actions gate on the `platform_admins` allowlist
  > (`src/lib/admin/guard.ts`). A call site with no such gate is a finding,
  > not a convenience.

- `docs/PRD-bursar-develop.md`: add the platform admin panel under whichever
  section lists internal/operator tooling (create one if none exists yet),
  stating plainly that it is operator-only, read-only in this version, and
  not a feature a school ever sees.
- `docs/backlog.md`: move the "admin panel" line (added when this spec
  started) to `done` once this ships, and add the two deferred items as
  their own `idea` rows: "Platform admin: manage school/account state" and
  "Platform admin: impersonate a school login for support", each noting it
  needs its own spec.

---

## Definition of done for this plan

Same five checks CLAUDE.md always requires, plus the schema-touches-auth
security audit specifically:

1. `npx tsc --noEmit` clean.
2. `npm run test` green, including the two new tests above.
3. `npm run build` clean.
4. CLAUDE.md, PRD, backlog updated as above, in the commits that make them
   true.
5. Security audit run before and after, specifically checking: no policy or
   grant on `platform_admins` reaches `anon`/`authenticated`; the RLS on
   every other table is byte-for-byte unchanged by this work (the diff on
   `schema.sql`'s existing policies should be empty); `requirePlatformAdmin`
   is the first line of every function in `src/lib/admin/`.
