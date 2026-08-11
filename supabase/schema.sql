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
create type student_status as enum ('active', 'graduated', 'withdrawn', 'pending');
create type staff_type      as enum ('teaching', 'non_teaching');
create type expense_cadence as enum ('one_off', 'monthly', 'yearly');

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
  bank_account_number text,
  bank_account_name   text,
  bank_name           text,
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
  discount_reason text,                          -- e.g. 'Scholarship', 'Sibling'
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
-- Money out: staff register and the expenses ledger (Bursar v1.1)
-- ---------------------------------------------------------------------------
-- Staff are people the school pays a salary — kept separate from `profiles`
-- (Bursar logins). `assignment` holds the class a primary teacher takes or the
-- subjects a secondary teacher takes; salary is the monthly amount.
create table staff (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references schools(id) on delete cascade,
  full_name           text not null,
  title               text,
  employment_type     staff_type not null default 'teaching',
  assignment          text,
  monthly_salary_kobo bigint not null default 0 check (monthly_salary_kobo >= 0),
  phone               text,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- The single money-out ledger: vendor spend AND staff salaries live here, so
-- the daily ledger can union payments (in) with expenses (out). cadence tags a
-- row one-off / monthly / yearly. When staff_id + salary_period are set the row
-- is a salary payment, and the unique index below blocks paying a staff member
-- twice for the same month.
create table expenses (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id) on delete cascade,
  session_id       uuid references sessions(id) on delete set null,
  payee            text not null,
  description      text not null,
  category         text not null,
  cadence          expense_cadence not null default 'one_off',
  amount_kobo      bigint not null check (amount_kobo > 0),
  spent_on         date not null default current_date,
  method           pay_method not null default 'cash',
  staff_id         uuid references staff(id) on delete set null,
  salary_period    text,                          -- 'YYYY-MM' for salary rows
  recorded_by      uuid references profiles(id),
  recorded_by_name text not null,
  note             text,
  created_at       timestamptz not null default now()
);

create unique index expenses_staff_salary_period_uq
  on expenses (staff_id, salary_period)
  where staff_id is not null and salary_period is not null;

create index on staff (school_id, active);
create index on expenses (school_id, spent_on);
create index on expenses (school_id, category);

-- Non-fee money in: donations, grants, sales, rentals. Unions into the ledger
-- as credits alongside fee payments.
create table income (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id) on delete cascade,
  session_id       uuid references sessions(id) on delete set null,
  source           text not null,
  description      text not null,
  amount_kobo      bigint not null check (amount_kobo > 0),
  received_on      date not null default current_date,
  method           pay_method not null default 'cash',
  recorded_by      uuid references profiles(id),
  recorded_by_name text not null,
  note             text,
  created_at       timestamptz not null default now()
);

create index on income (school_id, received_on);

-- Append-only money audit trail. Written ONLY by the log_money_change() trigger
-- (below), never by the client. No update/delete policy exists, so entries can
-- be neither forged nor erased through the API.
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  actor_id    uuid,
  actor_name  text,
  action      text not null,   -- created | edited | deleted
  entity      text not null,   -- payment | expense | income
  entity_id   uuid,
  summary     text not null,
  amount_kobo bigint,
  created_at  timestamptz not null default now()
);

create index on audit_log (school_id, created_at);

-- ---------------------------------------------------------------------------
-- Academic records: subjects and per-student assessments
-- ---------------------------------------------------------------------------
create table subjects (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index on subjects (school_id);

create table assessments (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id) on delete cascade,
  student_id       uuid not null references students(id) on delete cascade,
  subject_id       uuid not null references subjects(id) on delete cascade,
  session_id       uuid references sessions(id) on delete set null,
  term             term_name not null,
  ca1              smallint check (ca1 between 0 and 20),
  ca2              smallint check (ca2 between 0 and 20),
  exam             smallint check (exam between 0 and 60),
  recorded_by      uuid references profiles(id),
  recorded_by_name text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (student_id, subject_id, session_id, term)
);
create index on assessments (school_id, term);

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
alter table staff      enable row level security;
alter table expenses   enable row level security;
alter table income      enable row level security;
alter table audit_log   enable row level security;
alter table subjects    enable row level security;
alter table assessments enable row level security;

-- Everyone signed in may read rows for their own school. -------------------
create policy read_same_school on schools
  for select using (id = auth_school_id());
-- Bank details and other school settings: only Proprietor/Bursar may update.
-- UPDATE only (no insert/delete from the client); schools are created server-side.
create policy manage_school on schools
  for update using (id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (id = auth_school_id() and auth_role() in ('proprietor','bursar'));
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

-- Students & guardians: only Proprietor and Bursar may write. ----------------
-- Teachers get read-only via the read_same_school policy above.
create policy manage_students on students
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));
create policy manage_guardians on guardians
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));

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

-- Staff & expenses (money out): only Proprietor and Bursar may read or manage.
-- Teachers have no access at all. Expenses allow UPDATE/DELETE by design — a
-- cashbook needs corrections (unlike append-only payment receipts).
create policy manage_staff on staff
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));
create policy manage_expenses on expenses
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));

-- Income (money in): same shape as expenses. Proprietor/Bursar only.
create policy read_same_school on income
  for select using (school_id = auth_school_id());
create policy manage_income on income
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar'));

-- Audit trail: readable by anyone in the school; NO write policy exists, so the
-- client can never insert, edit, or delete an entry. Rows arrive only via the
-- log_money_change() trigger, which runs as SECURITY DEFINER.
create policy read_same_school on audit_log
  for select using (school_id = auth_school_id());

-- Subjects & assessments: staff (including teachers) may read and write.
create policy read_same_school on subjects
  for select using (school_id = auth_school_id());
create policy manage_subjects on subjects
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar','teacher'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar','teacher'));
create policy read_same_school on assessments
  for select using (school_id = auth_school_id());
create policy manage_assessments on assessments
  for all using (school_id = auth_school_id() and auth_role() in ('proprietor','bursar','teacher'))
  with check (school_id = auth_school_id() and auth_role() in ('proprietor','bursar','teacher'));

-- ============================================================================
-- Grants — least privilege for the PostgREST API roles
-- ============================================================================
-- anon (logged-out) gets nothing: Bursar requires a signed-in account. The
-- default TRUNCATE/REFERENCES/TRIGGER grants are a data-destruction primitive
-- and are removed. authenticated may run DML; RLS still governs which rows.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, insert, update, delete on table
  schools, sessions, classes, guardians, students,
  fee_items, bills, bill_lines, payments, staff, expenses, income,
  subjects, assessments
  to authenticated;
grant select on table profiles to authenticated;          -- write blocked: role escalation prevention
grant select on table audit_log to authenticated;         -- read-only: written by trigger only
grant select on table student_balances to authenticated;  -- view is read-only

-- service_role is the trusted, server-only admin role (secret key, never in the
-- browser). It bypasses RLS but still needs table privileges to write — the
-- onboarding/provisioning server actions run as service_role.
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

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

-- ============================================================================
-- Money audit trail triggers
-- ============================================================================
-- Every insert/update/delete on payments, expenses, and income writes an
-- audit_log row automatically. SECURITY DEFINER so it can insert into audit_log
-- (which the client cannot write). Because it fires from the trigger, a client
-- can never omit or forge an entry. EXECUTE is revoked from public so it cannot
-- be called directly as an RPC.
create or replace function log_money_change() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_row     record;
  v_action  text;
  v_entity  text := TG_ARGV[0];
  v_summary text;
  v_actor   uuid := auth.uid();
  v_name    text;
begin
  if TG_OP = 'DELETE' then v_row := OLD; v_action := 'deleted';
  elsif TG_OP = 'UPDATE' then v_row := NEW; v_action := 'edited';
  else v_row := NEW; v_action := 'created';
  end if;

  if v_entity = 'payment' then v_summary := 'Payment receipt ' || coalesce(v_row.receipt_no, '');
  elsif v_entity = 'expense' then v_summary := 'Expense to ' || coalesce(v_row.payee, '');
  else v_summary := 'Income: ' || coalesce(v_row.source, '');
  end if;

  select full_name into v_name from profiles where id = v_actor;

  insert into audit_log (school_id, actor_id, actor_name, action, entity, entity_id, summary, amount_kobo)
  values (v_row.school_id, v_actor, v_name, v_action, v_entity, v_row.id, v_summary, v_row.amount_kobo);

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

revoke execute on function log_money_change() from public;

create trigger audit_payments after insert or update or delete on payments
  for each row execute function log_money_change('payment');
create trigger audit_expenses after insert or update or delete on expenses
  for each row execute function log_money_change('expense');
create trigger audit_income after insert or update or delete on income
  for each row execute function log_money_change('income');
