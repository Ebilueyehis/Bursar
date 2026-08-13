# Bursar

**Every naira accounted for.**

A digital school administrator for Nigerian schools: student records, fees, exam
results, and every payment accounted for in one place. Built mobile-first as an
installable PWA for small and medium schools where staff work mostly from phones.

## Run it

```bash
npm install --legacy-peer-deps
```

```bash
npm run dev
```

Open http://localhost:3000. Sign-in is Google OAuth against a live Supabase
project, so you need `.env.local` populated from `.env.example` before anything
past `/login` will load.

```bash
npm run test
```

```bash
npm run build
```

## Read this before contributing

`CLAUDE.md` carries the definition of done, the standing rules, and how work
flows from idea to backlog to spec to plan to code. It applies to everyone.

The short version: money is integer kobo, the database is the security boundary,
the PRD is updated in the same commit as the feature, and anything noticed but
not fixed goes into `docs/backlog.md` before the commit lands.

## What is built

See `docs/PRD-bursar-develop.md` for the full picture, including what is
deliberately not built. In outline:

- **Dashboard**: outstanding balance, received against expected, who to follow up.
- **Students**: records with guardian details, bulk import, per-student bills,
  discounts, and a temporary registration path that hands a parent a printed
  provisional bill the same day.
- **Payments hub**: ledger, all money in, money out, and a tamper-evident audit
  trail written by a database trigger.
- **Exams and Records**: CA and exam entry, class and subject averages, a report
  per student, and a spreadsheet template that round-trips.
- **Staff and payroll**, **fee structures**, **user roles**.
- **Your records**: export the whole school to one workbook, any time.
- Role-based access enforced in the database, dark theme, installable PWA,
  printable receipts.

## Where things live

| Concern | Where |
| --- | --- |
| Design system and voice | `src/app/globals.css`, `src/components/ui.tsx`, `voice-guide.md` |
| Domain model and rules | `src/lib/domain/`, `src/lib/money.ts` (money is integer **kobo**, never float) |
| Data access | `src/lib/data/repository.ts`, the single interface every screen uses, with two implementations: `mock.ts` and `supabase-repo.ts` |
| Database schema and RLS | `supabase/schema.sql` |
| App shell and navigation | `src/components/AppShell.tsx` |
| Messaging | `src/lib/messaging/` (adapter written, not yet wired to a route) |
| PWA | `public/manifest.webmanifest`, `public/sw.js` |
| Backups and recovery | `.github/workflows/`, `docs/runbooks/` |

Every screen talks only to the `Repository` interface. That is the fastest way
into the domain: read it first.

## Documentation map

| File | What it answers |
| --- | --- |
| `CLAUDE.md` | How we work, and what done means |
| `docs/PRD-bursar-develop.md` | What is built, and what is deliberately not |
| `docs/backlog.md` | What is coming, and what was rejected and why |
| `voice-guide.md` | How the product speaks |
| `docs/superpowers/specs/` | Why things are the way they are |
| `docs/superpowers/plans/` | Task-by-task implementation plans |
| `docs/runbooks/` | What to do when something breaks |
| `docs/capacity-and-cost.md` | Storage growth, hosting cost, upgrade triggers |
| `docs/sales-kit/` | Prompts that generate the sales documents |

## Operational notes

Backups run nightly from GitHub Actions: `pg_dump`, encrypted to an `age`
recipient public key, stored in Cloudflare R2. The CI job can write backups and
cannot read one back. **The private key is a founder-held secret with no
recovery path**: lose it and every backup ever taken is unreadable.

Scheduled workflows only fire from `main`, and they do nothing until the eight
secrets in `docs/runbooks/backup-setup.md` exist. A backup is not real until a
restore drill is dated in `docs/runbooks/restore.md`.
