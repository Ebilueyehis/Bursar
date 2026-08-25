# Platform admin panel: design

## What this is

A screen only the Bursar operator (you) can reach, showing every school on the
platform in one place: name, code, when it was onboarded, how many active
students it has, and when it last recorded a payment. Read-only. Nothing here
lets an admin change a school's data or log in as one of its users.

This is not the in-school admin screen a Proprietor uses for their own school
(managing staff logins, fee structures, and so on) — that is a separate,
lower-risk piece of work and is not in scope here.

## Why this exists

Right now the only way to know how a pilot school is doing is to query the
database by hand. That does not scale past a handful of schools, and it means
every check is a one-off script rather than something repeatable.

## Decisions and why

**1. Access is server-only, through an allowlist, not a change to RLS.**

The alternative was adding `or is_platform_admin()` to every read policy in
`schema.sql`, so admin pages could use the ordinary authenticated client. That
was rejected: it touches every table's RLS at once, and it means "who can read
this row" no longer has one answer written on the policy itself — a future
reader would have to also know whether the caller might be a platform admin.
The database being the security boundary only means something if reading it
requires reading one place.

Instead: a new table, `platform_admins`, holds the user ids allowed in (today,
just yours). RLS stays completely untouched — every existing policy keeps
meaning exactly what it says. Admin pages are server actions that:

1. Read the caller's session with the ordinary server client.
2. Check `auth.uid()` against `platform_admins` — itself queried through the
   admin client, since no RLS policy grants `authenticated` anything on that
   table at all (not even reading your own row). This is deliberate: the
   allowlist can be neither read nor guessed at from a signed-in session.
3. Only then run the actual cross-school query via the admin (service-role)
   client.

A caller who is not on the allowlist gets an error before any cross-school
query runs. Tenant isolation for every ordinary user is identical to today,
because RLS never changed.

**2. The service-role invariant is extended, not broken, and CLAUDE.md changes
in the same commit as the code.**

CLAUDE.md currently says the service-role key "is imported in exactly one
file, `src/app/onboarding/actions.ts`... If a second import site appears, that
is a finding, not a convenience." This work deliberately adds a second site.

Rather than quietly breaking that invariant, the rule is being narrowed to
what it actually protects: that privileged, RLS-bypassing access is opened in
as few places as possible, each one gated on something other than "the caller
has a valid session." The new wording (see the CLAUDE.md diff in the plan):
the service-role key is read in exactly one module,
`src/lib/supabase/admin.ts`; every file that calls `createAdminClient()` must
gate on something beyond authentication (onboarding gates on "no profile
exists yet", admin actions gate on the `platform_admins` allowlist); a third
call site with no such gate is the finding.

**3. V1 is read-only: list schools and their metrics. No mutation, no
impersonation.**

Two riskier capabilities were considered and deliberately deferred:

- *Editing school/account state* (suspending a school, changing pilot
  status) — there is nowhere yet to put that state; `schools` has no
  status/billing columns today. Adding them now, before there is a second
  pilot school to prove the shape against, is guessing at a schema.
- *Impersonating a school's login for support* — this means a platform admin
  can act inside a school's real financial data under another user's
  identity. That is a different, larger threat model (who gets logged, how
  the session is scoped, how the school could ever know it happened) and
  deserves its own spec rather than riding in on this one.

Both stay in the backlog as `idea`, not `agreed`.

**4. No new database state beyond the allowlist table.**

The metrics shown (student count, last payment date) are computed by the
admin client querying existing tables directly — `students`, `payments` —
grouped by `school_id`. Nothing is denormalised or cached in v1. If the list
of schools grows large enough that this is slow, that is a later, measured
problem, not one to solve speculatively now.

## What "admin" means here, concretely

A user is a platform admin if and only if their `auth.uid()` has a row in
`platform_admins`. There is no role column, no tiers — either you're on the
list or the page refuses you. Today the list has one operator: you, added by
hand via SQL, the same way the first Proprietor's care is taken with any
row that grants privilege.

## Schema change

```sql
create table platform_admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  note       text,                 -- who this is / why, for your own record
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;
-- Deliberately no policy for anon or authenticated: this table is invisible
-- to every ordinary client request, readable only through the service-role
-- client (which bypasses RLS). No grant statement for anon/authenticated
-- either, so PostgREST refuses even with a policy misconfiguration.
```

`service_role` already gets full access to future tables via the existing
`alter default privileges ... grant ... to service_role` statement, so no
extra grant is needed there.

## Screens

One route, `/platform-admin`, listing every school as a table:

| Column | Source |
| --- | --- |
| School name, code | `schools` |
| Onboarded | `schools.created_at` |
| Active students | `count(*) from students where status = 'active'` |
| Last payment recorded | `max(payments.created_at)` per school |

No filters, no pagination in v1 — the school count is small enough that a
single page is fine, and pagination for a list of a dozen rows would be
speculative.

## Out of scope, written down so it is not silently forgotten

- Editing any school's data from this panel.
- Suspending or deactivating a school.
- Impersonating a school user.
- A role/tier system for admins beyond "on the list or not."
- Any UI for adding/removing platform admins — that stays a manual SQL
  operation until there is a second admin to onboard.
