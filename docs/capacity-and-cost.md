# Capacity and cost

Measured against the live project `pbrirletzhvanmmxithr` on 2026-08-12, so
pricing can rest on arithmetic rather than a guess.

At the time of measurement the whole `public` schema was **728 kB** across 16
tables holding seed data only: 5 students, 4 payments, 45 classes, 45 fee items,
36 subjects. Almost all of that is fixed per-table and per-index overhead rather
than data, which is the reason the model below is built from row counts instead
of from extrapolating today's size.

## Rows per year, for one 300 student school

| Table | Rows per year | How it arises |
| --- | --- | --- |
| assessments | ~10,800 | 300 students x 12 subjects x 3 terms. Dominates everything else. |
| bill_lines | ~3,600 | 900 bills x 4 fee lines |
| audit_log | ~2,500 | one per money write, plus updates |
| payments | ~1,800 | 300 students x 3 terms x roughly 2 instalments |
| bills | ~900 | 300 students x 3 terms |
| expenses | ~600 | |
| students, guardians | ~300 each | one off at enrolment, not annual |
| classes, fee_items, subjects | under 150 | fixed per school |

Roughly **21,000 rows and 5 to 10 MB per school year**, including indexes.

## What that means

| Plan | Included storage | School years it holds |
| --- | --- | --- |
| Free | 500 MB | 50 or more |
| Pro | 8 GB | effectively unbounded for any realistic horizon |

Storage is not the constraint. Egress and the plan floor are.

## Cost against revenue

One 300 student school at 350 naira per student per term bills about 315,000
naira a year. One Pro plan at 25 dollars a month carries dozens of schools.
Infrastructure therefore sits in low single digit percent of revenue at any
meaningful scale.

## Backup storage

The nightly dump is compressed and encrypted, so each object is smaller than the
live database. At 35 daily copies and 12 monthly copies, a single school stays
comfortably inside Cloudflare R2's 10 GB free allowance for years. R2 charges
nothing for egress, which matters because the day a restore is needed is a bad
day to meet a transfer bill.

## When to move to Supabase Pro

Whichever comes first:

- the first school that pays;
- database size crossing 300 MB, which is 60 percent of the free 500 MB;
- monthly egress crossing 3 GB, which is 60 percent of the free 5 GB;
- any second school recording live money.

Written down so the decision is made once rather than re-argued monthly.

Note what the free plan does not include: no restorable backup, no
point-in-time recovery, and the project pauses after seven days without API
activity. The nightly dump in `docs/runbooks/backup-setup.md` covers the first
two, and the keep-alive step in the same workflow covers the third.

## Monthly check

Record actual figures here on the first of each month.

| Month | Database size | Monthly egress | Schools live | Action |
| --- | --- | --- | --- | --- |
| 2026-08 | 728 kB | negligible | 0 live, seed data only | none |
