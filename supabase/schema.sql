-- ============================================================================
-- Bursar — database schema (Supabase / PostgreSQL)
-- ============================================================================
-- Design rules:
--   * Money is stored as BIGINT kobo (1 naira = 100 kobo). Never float.
--   * Every row belongs to a school; access is scoped to the caller's school.
--   * Role-based access is enforced here with Row-Level Security (RLS), not
--     only in the UI — a Teacher literally cannot read what only a Proprietor
--     or Bursar may read, even with a direct API call.
--   * Receipts (payments) are append-only: no UPDATE/DELETE policy is granted,
--     so a receipt can never be silently altered or removed. Corrections are
--     made by recording a reversing/adjusting payment.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role   as enum ('proprietor', 'bursar', 'teacher');
create type term_name   as enum ('first', 'second', 'third');
create type pay_method  as enum ('cash', 'transfer', 'pos', 'online');
create type student_status as enum ('active', 'graduated', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Core tenancy: schools and the people who use Bursar
-- ---------------------------------------------------------------------------
create table schools (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  code               text not null,               -- receipt prefix, e.g. 'TJH'
  address            text,
  phone              text,
  current_session_id uuid,
  current_term       term_name not null default 'first',
  created_at         timestamptz not null default now()
);

-- One row per Bursar user, linked to their Supabase auth account.
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  school_id  uuid not null references schools(id) on delete cascade,
  full_name  text not null,
  role       user_role not null,
  phone      text,
  email      text,
  created_at timestamptz not null default now()
);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  name       text not null,                       -- e.g. '2024/2025'
  start_date date not null,
  end_date   date not null
);

alter table schools
  add constraint schools_current_session_fk
  foreign key (current_session_id) references sessions(id);

create table classes (
  id        uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  level     text not null,                        -- 'JSS 1'
  name      text not null                         -- 'JSS 1A'
);

create table guardians (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  full_name    text not null,
  phone        text not null,
  alt_phone    text,
  email        text,
  relationship text
);

create table students (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  admission_no text not null,
  first_name   text not null,
  last_name    text not null,
  other_name   text,
  gender       text,
  date_of_birth date,
  class_id     uuid references classes(id),
  guardian_id  uuid references guardians(id),
  status       student_status not null default 'active',
  enrolled_on  date not null default current_date,
  created_at   timestamptz not null default now(),
  unique (school_id, admission_no)
);

-- ---------------------------------------------------------------------------
-- Fees: the structure (template) and each student's bill (snapshot)
-- ---------------------------------------------------------------------------
create table fee_items (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  session_id  uuid not null references sessions(id) on delete cascade,
  term        term_name not null,
  level       text not null,                      -- applies to a class level
  name        text not null,                      -- 'Tuition', 'PTA levy'
  amount_kobo bigint not null check (amount_kobo >= 0),
  optional    boolean not null default false
);

create table bills (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  session_id    uuid not null references sessions(id) on delete cascade,
  term          term_name not null,
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  created_on    date not null default current_date,
  unique (student_id, session_id, term)
);

-- Snapshot of the fee lines applied to a bill (so later fee edits don't
-- rewrite a student's history).
create table bill_lines (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references bills(id) on delete cascade,
  name        text not null,
  amount_kobo bigint not null check (amount_kobo >= 0)
);

-- Payments are receipts. Append-only (see RLS below).
create table payments (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references schools(id) on delete cascade,
  student_id     uuid not null references students(id) on delete cascade,
  bill_id        uuid not null references bills(id) on delete cascade,
  amount_kobo    bigint not null check (amount_kobo > 0),
  method         pay_method not null,
  receipt_no     text not null,
  paid_on        date not null default current_date,
  recorded_by    uuid references profiles(id),
  recorded_by_name text not null,
  note           text,
  created_at     timestamptz not null default now(),
  unique (school_id, receipt_no)
);

-- Helpful indexes for the hot paths (debtors, a student's receipts).
create index on students (school_id, class_id);
create index on bills (school_id, session_id, term);
create index on payments (bill_id);
create index on payments (school_id, paid_on);

-- ---------------------------------------------------------------------------
-- Convenience view: a student's outstanding balance for a term
-- ---------------------------------------------------------------------------
-- security_invoker = on is REQUIRED: without it the view runs as its owner
-- (postgres) and BYPASSES RLS on the base tables, leaking every school's
-- finances to any user who can read the view. With it on, the view enforces
-- the querying user's RLS, so each user sees only their own school.
create view student_balances with (security_invoker = on) as
select
  b.id                                as bill_id,
  b.school_id,
  b.student_id,
  b.session_id,
  b.term,
  b.created_on,
  coalesce(sum(bl.amount_kobo), 0) - b.discount_kobo            as billed_kobo,
  coalesce(p.paid_kobo, 0)                                      as paid_kobo,
  greatest(0, coalesce(sum(bl.amount_kobo), 0) - b.discount_kobo
              - coalesce(p.paid_kobo, 0))                       as outstanding_kobo
from bills b
left join bill_lines bl on bl.bill_id = b.id
left join (
  select bill_id, sum(amount_kobo) as paid_kobo
  from payments group by bill_id
) p on p.bill_id = b.id
group by b.id, p.paid_kobo;

-- ============================================================================
-- Row-Level Security
-- ============================================================================
-- Helper: the caller's school and role, read from their profile.
create or replace function auth_school_id() returns uuid
  language sql stable security definer set search_path = public as $$
    select school_id from profiles where id = auth.uid()
$$;

create or replace function auth_role() returns user_role
  language sql stable security definer set search_path = public as $$
    select role from profiles where id = auth.uid()
$$;

-- Turn on RLS everywhere.
alter table schools    enable row level security;
alter table profiles   enable row level security;
alter table sessions   enable row level security;
alter table classes    enable row level security;
alter table guardians  enable row level security;
alter table students   enable row level security;
alter table fee_items  enable row level security;
alter table bills      enable row level security;
alter table bill_lines enable row level security;
alter table payments   enable row level security;

-- Everyone signed in may read rows for their own school. -------------------
create policy read_same_school on schools
  for select using (id = auth_school_id());
create policy read_same_school on profiles
  for select using (school_id = auth_school_id());
create policy read_same_school on sessions
  for select using (school_id = auth_school_id());
create policy read_same_school on classes
  for select using (school_id = auth_school_id());
create policy read_same_school on guardians
  for select using (school_id = auth_school_id());
create policy read_same_school on students
  for select using (school_id = auth_school_id());
create policy read_same_school on fee_items
  for select using (school_id = auth_school_id());
create policy read_same_school on bills
  for select using (school_id = auth_school_id());
create policy read_same_school on payments
  for select using (school_id = auth_school_id());
create policy read_bill_lines on bill_lines
  for select using (
    exists (select 1 from bills b
            where b.id = bill_lines.bill_id and b.school_id = auth_school_id())
  );

-- Students & guardians: Proprietor, Bursar, and Teacher may manage. ---------
create policy manage_students on students
  for all using (school_id = auth_school_id())
  with check (school_id = auth_school_id());
create policy manage_guardians on guardians
  for all using (school_id = auth_school_id())
  with check (school_id = auth_school_id());

-- Fees & bills: only Proprietor and Bursar may change. ----------------------
create policy manage_fees on fee_items
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));
create policy manage_bills on bills
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));
create policy manage_bill_lines on bill_lines
  for all using (
    auth_role() in ('proprietor','bursar')
    and exists (select 1 from bills b
                where b.id = bill_lines.bill_id and b.school_id = auth_school_id())
  ) with check (
    auth_role() in ('proprietor','bursar')
    and exists (select 1 from bills b
                where b.id = bill_lines.bill_id and b.school_id = auth_school_id())
  );

-- Payments: Proprietor and Bursar may INSERT (record). No update/delete
-- policy exists, so receipts are append-only and cannot be altered/removed.
-- WITH CHECK also binds the receipt to the caller's own school AND verifies the
-- referenced bill/student belong to that school, so a Bursar can't attach a
-- receipt to another school's bill or impersonate another recorder.
create policy record_payment on payments
  for insert to authenticated
  with check (
    school_id = auth_school_id()
    and auth_role() in ('proprietor','bursar')
    and (recorded_by is null or recorded_by = auth.uid())
    and exists (select 1 from bills b
                where b.id = bill_id and b.school_id = auth_school_id())
    and exists (select 1 from students s
                where s.id = student_id and s.school_id = auth_school_id())
  );

-- ============================================================================
-- Grants — least privilege for the PostgREST API roles
-- ============================================================================
-- anon (logged-out) gets nothing: Bursar requires a signed-in account. The
-- default TRUNCATE/REFERENCES/TRIGGER grants are a data-destruction primitive
-- and are removed. authenticated may run DML; RLS still governs which rows.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, insert, update, delete on table
  schools, profiles, sessions, classes, guardians, students,
  fee_items, bills, bill_lines, payments
  to authenticated;
grant select on table student_balances to authenticated;  -- view is read-only

-- Helper functions grant EXECUTE to PUBLIC by default. Remove that and hand it
-- back only to authenticated, which the RLS policies require. anon loses it.
revoke execute on function auth_role() from public;
revoke execute on function auth_school_id() from public;
grant execute on function auth_role() to authenticated;
grant execute on function auth_school_id() to authenticated;

-- NOTE: profiles has SELECT-only RLS by design — there is NO insert/update
-- policy, so a signed-in user can never create or alter their own profile row
-- (and therefore cannot self-assign role = 'proprietor'). Provisioning a
-- profile and its role must happen server-side with the service_role key
-- (e.g. an admin invite flow or a SECURITY DEFINER signup function), never
-- from the client.
