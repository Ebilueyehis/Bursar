# Reliability, receipt delivery, and offline reading

**Date:** 2026-08-12
**Status:** Design, awaiting review.
**Covers:** five problems raised against the current build, plus two refinements
to the first proposal.

> **Update, 2026-09-01:** the backup host named below (Cloudflare R2) was
> replaced with Backblaze B2 after repeated Cloudflare dashboard outages
> blocked initial setup. The reasoning here for *why a backup at all* still
> holds; for the current storage provider and setup steps, see
> `docs/runbooks/backup-setup.md`.

---

## 1. The problems

1. **Receipt delivery depends on a printer.** Every receipt path ends at
   `window.print()`. The mini-printer was meant as a cross-sell, not as the only
   route, and thermal paper fades. Hardware cost, maintenance, and delay sit on
   the critical path of handing a parent proof of payment.
2. **No way back from a receipt.** Two receipt paths open a popup window
   containing bare HTML whose only control is a Print button. It is not a screen
   inside the app, so there is no back, no navigation, nothing.
3. **Weak network reads as a broken app.** No visible pending state, no
   navigation feedback, and connectivity is judged by `navigator.onLine`, which
   reports "online" on a connection that is not moving data.
4. **No protection for the money data.** The project is on the Supabase free
   plan: no restorable backup, no point-in-time recovery, and the project pauses
   after seven days idle. There is no export job anywhere.
5. **Unknown storage growth and hosting cost.** No model for what a school costs
   to host as student counts grow.

### What the investigation found beyond the report

- The success screen after a payment does have exits. The stuck screen is the
  popup from `printReceipt` in `src/app/students/[id]/page.tsx`, which mobile
  browsers also frequently block outright. Problems 1 and 2 are one problem.
- **Offline reading does not exist.** The PRD promises records are viewable
  without a connection. `public/sw.js` caches the app shell and static assets
  and returns early on every cross-origin request, which is every Supabase call.
  There is no IndexedDB in the codebase. Offline currently means the app opens
  to empty screens. Problem 3 is partly a gap between promise and build.
- Money buttons already carry `disabled={submitting || !online}`, so the
  double-tap window is smaller than reported. What is missing is any visible
  evidence that work is happening.
- Free plan confirmed live: organisation `xcrycbyueanhiooirxzq`, plan `free`,
  project `pbrirletzhvanmmxithr`, region `eu-west-2`.

---

## 2. Decisions and why

| Decision | Choice | Reason |
| --- | --- | --- |
| Backup host | Cloudflare R2 | 10 GB free with no 12-month expiry, zero egress so a restore costs nothing on the day it is needed, S3-compatible tooling. |
| Supabase plan | Stay free for now | $25/month is not defensible at zero revenue. The two things Pro buys, no-pause and daily backups, are obtainable for nothing. Upgrade on a written trigger, not a feeling. |
| Offline scope | Cache reads, keep money writes online | Closes the promise already made. An offline write queue introduces new failure modes on money records during a pilot whose entire purpose is proving the records can be trusted. Recorded as a deferred phase in section 8, not discarded. |
| Duplicate submissions | Idempotency key, not warning copy | Making a second tap harmless is correctness. Telling a user not to tap is instruction, and it fails exactly when the person is anxious. |
| Navigation feedback | Route-level `loading.tsx` | A header progress bar is fragile where mobile browser chrome moves. Skeletons change the screen instantly, need no custom component, and do not depend on the header. |
| Receipt format | PNG image, shared via the OS share sheet | WhatsApp renders an image inline, so a parent sees the receipt without opening a file. A PDF becomes an attachment nobody opens. |
| Sequencing | Continuity, receipts, network, offline cache | Data loss is the only unrecoverable item, and it is also the smallest build. |

---

## 3. Workstream A: continuity and backups

**Goal:** no single failure, including one of our own making, can destroy a
school's payment history.

### A1. Nightly encrypted dump to R2

A GitHub Actions workflow, `.github/workflows/backup.yml`, on a nightly cron at
02:00 UTC (03:00 in Lagos, comfortably after a school day).

Steps:
1. Install `postgresql-client-17` and `age`.
2. `pg_dump` the database using `SUPABASE_DB_URL`, custom format, to a temp file.
3. Encrypt with `age --recipient "$BACKUP_AGE_RECIPIENT"`. This is a **public
   key**: the runner can write backups and cannot read any of them, including
   its own. The private key lives with the founder, offline, and never enters
   GitHub.
4. Upload to R2 with the AWS CLI against the R2 S3 endpoint, to
   `daily/bursar-YYYY-MM-DD.dump.age`.
5. On the first of the month, copy the same object to `monthly/`.

Secrets required, all GitHub repository secrets:
`SUPABASE_DB_URL`, `BACKUP_AGE_RECIPIENT`, `R2_ACCOUNT_ID`, `R2_BUCKET`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

The R2 token is scoped to object write on that one bucket. It must not carry
delete or list permission on anything else.

Retention is an R2 lifecycle rule, not job logic: `daily/` expires after 35
days, `monthly/` after 400. Lifecycle rules keep running even if the workflow
breaks, which job-side pruning does not.

**Failure must be loud.** A backup job that silently stops is worse than none,
because it manufactures confidence. The workflow fails the run on any non-zero
step, and a second scheduled workflow checks weekly that an object newer than
48 hours exists in `daily/`, failing if not. GitHub emails on workflow failure.

### A2. Keep-alive

Free projects pause after seven days of inactivity. A pilot school breaking for
holidays is exactly that. The same nightly workflow makes one authenticated
REST call against the project with the anon key, in addition to the database
connection, since pause is measured on API activity. Cost: nothing.

### A3. Restore drill

A backup nobody has restored is a rumour. Before this workstream is called
done: restore the most recent dump into a scratch Supabase project, confirm a
known receipt and its student come back intact, and record in
`docs/runbooks/restore.md` the exact commands, the time it took, and the date it
was proven. Re-run the drill whenever the schema changes shape.

### A4. In-app export for the school

A single control in the Profile hub: **Export all school records**, producing
one `.xlsx` with a sheet per table (students, guardians, classes, fee items,
bills, bill lines, payments, expenses, income, staff, assessments). It reuses
the existing `exportToXlsx` utility and the deferred-work pattern already in
place there.

This is not primarily a technical safeguard. It is the visible proof of the
promise the sales documents make, that the school's records are the school's,
and it gives a proprietor something to walk away with.

### A5. The written upgrade trigger

Move to Supabase Pro on whichever comes first:
- the first school that pays;
- database size crossing 300 MB (60% of the free 500 MB);
- monthly egress crossing 3 GB (60% of the free 5 GB);
- any second school recording live money.

Recorded in `docs/capacity-and-cost.md` so the decision is not re-argued.

---

## 4. Workstream B: receipt delivery

**Goal:** a receipt reaches a parent by the channel they already use, on paper
only if the school wants paper, and a receipt is never a dead end.

### B1. The receipt becomes a real screen

New route `/receipts/[paymentId]`, rendering inside the app shell with full
navigation. It shows the existing `Receipt` component and the student, guardian
and school context around it.

The two `window.open` popups in `src/app/students/[id]/page.tsx` are deleted.
Every place that offered "print receipt" now links to this route. The printable
provisional bill gets the same treatment at `/students/[id]/bill`.

Access follows the existing RLS: a receipt is readable only by a member of the
school that issued it. There is no public receipt link in this design. A
parent-facing link is a new security surface and is not needed to solve the
stated problem.

### B2. Four actions, printer among them

1. **Share.** Renders the receipt to a PNG and passes it to
   `navigator.share({ files })`, which puts WhatsApp one tap away alongside every
   other app on the phone. This is the primary path.
2. **Print.** Unchanged behaviour, now from a real screen. The mini-printer
   cross-sell survives as one option rather than the only one.
3. **Download.** Saves the PNG.
4. **Message guardian.** Opens `wa.me` with the guardian's number already on the
   student record and a short pre-filled message naming the amount and receipt
   number.

Point 4 exists because WhatsApp deep links cannot carry an attachment. Share
sends the image; Message sends the words. Both are offered rather than pretending
one does the other's job.

Where `navigator.canShare({ files })` is unsupported, Share is hidden and
Download plus Message carry the flow. No broken button.

### B3. Rendering, without a new dependency

The receipt image is drawn on a `<canvas>` by hand in
`src/lib/receipt/canvas.ts` rather than by converting DOM to image with a
library. Reasons: the bundle stays honest for low-end phones, the output is
identical on every device instead of inheriting whatever the browser did to the
CSS, and the receipt layout is simple and fixed.

The layout data is produced by a pure function, `receiptLines(payment, account,
school)`, returning label and value pairs. That function is unit tested; the
drawing code that consumes it is thin and untested by choice.

---

## 5. Workstream C: honest behaviour on a weak network

**Goal:** the person always knows whether their tap registered, and a tap that
repeats cannot cost money twice.

### C1. Duplicate writes become impossible, not discouraged

Every money write carries a client-generated `client_ref` UUID, created once per
attempt and reused across retries of that same attempt.

Schema: add `client_ref uuid` to `payments`, `expenses` and `income`, each with
a unique index. Nullable, so existing rows are unaffected.

Insert becomes `on conflict (client_ref) do nothing`, followed by a select of
the row with that key. A second arrival returns the original receipt rather than
issuing a new one. Retry after a timeout is therefore always safe, which is the
property that makes everything else in this workstream cosmetic rather than
load-bearing.

The unique index must be partial (`where client_ref is not null`) so historical
rows do not collide on null.

### C2. One screen state per outcome

The entry screen resolves into exactly one of three states, never a screen with
a spinning button and live controls:

- **Recording.** The form is replaced by a single calm panel naming what is
  happening: "Recording payment of ₦45,000 for Tunde Okafor." Nothing on screen
  is tappable, so a second tap is impossible by construction. No instruction not
  to tap.
- **Done.** The existing success screen and receipt.
- **Could not record.** States plainly that nothing was saved and offers Retry,
  which reuses the same `client_ref`. Voice guide rules apply: never blame the
  user, always say what is still safe, always give a next step.

The same three states apply to expenses, income, and payroll runs.

### C3. Navigation feedback via route skeletons

Add `loading.tsx` to each route segment: students, students/[id], payments,
records, entry, profile. Each renders a skeleton matching that screen's shape,
built from the existing `Spinner` and card primitives.

The App Router shows it the instant a link is tapped. The screen changes
immediately, with no custom progress component, no dependency on the header
being visible, and nothing to break when mobile browser chrome moves.

### C4. The current-page indicator that moves

The mobile bottom bar gains an indicator that slides between items as the route
changes: a short bar above the active item, animated with a CSS transform,
honouring `prefers-reduced-motion`. Pure presentation, independent of network
state. This is the moving element requested.

### C5. Connectivity that tells the truth

`useOnline` is replaced by `useConnection`, returning `"online" | "weak" |
"offline"`.

- `offline`: `navigator.onLine` is false.
- `weak`: a lightweight reachability probe against a tiny same-origin endpoint
  either exceeds a 3 second budget or fails while `navigator.onLine` is true.
  Probed on mount, on `online` events, and before a money write.
- `online`: otherwise.

The existing header badge gains the third state. Money writes are blocked only
on `offline`, as today. `weak` changes wording, not permission: the write is
attempted, and C1 makes a retry safe.

---

## 6. Workstream D: offline reading

**Goal:** deliver the promise already in the PRD, that records can be looked up
without a connection.

### D1. A caching decorator around the repository

The repository pattern already isolates every read behind an interface. A new
`withCache(repo)` in `src/lib/data/cache.ts` implements the same interface,
delegating to the wrapped repository and recording each successful read in
IndexedDB. On failure or while offline, it serves the stored copy.

No screen changes and no call sites move. Every screen imports `repository` from
`src/lib/data/repository.ts`, which is a single re-export line:

```ts
export { supabaseRepository as repository } from "@/lib/data/supabase-repo";
```

The wrapper goes in there and nowhere else, so the change is one line plus the
new module.

Reads cached: student accounts, student detail, classes, fee items, bills,
payments, ledger, income, expenses, dashboard aggregates, class record
summaries. Writes are never cached and never queued in this phase.

### D2. Cache keys must not leak across tenants

**This is the security-critical part of the workstream.** Every key is namespaced
by both `userId` and `schoolId`, never by method and arguments alone. The whole
store is cleared on sign-out and whenever the signed-in user changes.

A device shared between two schools, or a phone handed to a new bursar, must not
surface the previous tenant's records from a local cache that RLS never sees.
This is the one place in this design where a mistake produces cross-school data
exposure, so it gets an explicit test.

### D3. Saying which copy is on screen

When a screen is served from cache, a quiet line above the content reads
"Showing records saved at 10:42." Not a warning banner. The voice guide's
standard applies: state the fact, do not alarm.

On reconnect, cached screens refetch and the line disappears. Reads only, so
there is nothing to reconcile.

### D4. Service worker

`public/sw.js` gains versioned cache names tied to the build so a deploy cannot
serve a stale shell against a new bundle. It continues to skip cross-origin
requests; data caching belongs in D1 where it can be keyed by tenant, not in
the service worker where it cannot.

---

## 7. Workstream E: capacity and cost

Write `docs/capacity-and-cost.md` recording the measured model, so pricing rests
on arithmetic.

Measured on the live database, per 300-student school per year:

| Table | Rows per year | Note |
| --- | --- | --- |
| assessments | ~10,800 | 300 students x 12 subjects x 3 terms. Dominates everything. |
| bill_lines | ~3,600 | 900 bills x 4 lines |
| audit_log | ~2,500 | one per money write, plus updates |
| payments | ~1,800 | 300 students x 3 terms x ~2 instalments |
| bills | ~900 | |
| expenses | ~600 | |
| students, guardians | ~300 each | one-off, not annual |
| classes, fee_items, subjects | < 150 | fixed per school |

Roughly **21,000 rows and 5 to 10 MB per school-year** including indexes. Against
the free tier's 500 MB that is 50 or more school-years; against Pro's 8 GB it is
unbounded for any realistic horizon.

Cost framing: one 300-student school at ₦350 per student per term bills about
₦315,000 a year. One $25 Pro plan carries dozens of schools. Infrastructure sits
in low single-digit percent of revenue. Storage is not the constraint; egress
and the plan floor are.

The document also carries the A5 upgrade triggers and a monthly check to record
actual size and egress against them.

---

## 8. Deferred, and recorded rather than lost

**Offline payment recording with reserved receipt numbers.**

When it is time, the design is: a device reserves a block of receipt numbers
from the server while online, say 50. Payments recorded offline draw from that
block, so the parent receives a final receipt number rather than a provisional
one that changes later. Queued writes carry the `client_ref` from workstream C1,
which already makes replay safe, and sync on reconnect. Blocks are per device
and never overlap; unused numbers in an abandoned block are burned rather than
reissued, because a reused receipt number is worse than a gap in the sequence.

Not built now. During a pilot whose purpose is proving the records can be
trusted, the correctness risk on money outweighs the convenience.

---

## 9. Testing

- `receiptLines` produces the right labels, ordering and money formatting for a
  full payment, a partial payment, and a payment against a discounted bill.
- Idempotency: two writes with the same `client_ref` yield one row and the same
  receipt number, in both the mock and Supabase repositories.
- `useConnection` returns `weak` when the probe exceeds its budget while
  `navigator.onLine` is true.
- Cache: a read populates the store; a failing read serves the stored copy; a
  read under a different `userId` or `schoolId` does **not** see the first
  tenant's entry; sign-out empties the store.
- Backup: the weekly freshness check fails when no recent object exists. The
  restore drill is a manual gate, recorded with a date, not an automated test.

Existing standing rules apply unchanged: the full adversarial security audit
before and after each build, and the suite green at every step.

---

## 10. Risks

| Risk | Handling |
| --- | --- |
| Staying on the free plan leaves no platform-side restore | The nightly dump to R2 is the restore path, and it is proven by drill before this is called done. The upgrade trigger is written down. |
| A silently broken backup job manufactures false confidence | Weekly freshness check that fails loudly, plus workflow failure email. |
| The local cache leaks one school's records to another user on a shared device | Keys namespaced by user and school, store cleared on sign-out and on user change, with an explicit test. |
| Canvas receipt renders differently across devices | Fixed pixel layout drawn by hand rather than converted from CSS, which is the reason for choosing canvas over a DOM-to-image library. |
| `age` private key lost means every backup is unreadable | The key is a founder-held offline secret with a written second copy. Recorded in the restore runbook. |

---

## 11. How this becomes a plan

Four workstreams, built and verified in this order, each ending green before the
next begins:

1. **A, continuity.** Smallest, and the only one guarding against something
   unrecoverable. Ends when the restore drill is recorded as done.
2. **B, receipts.** The daily friction, and it dissolves the stuck-screen problem
   on the way.
3. **C, network honesty.** C1, the idempotency key, is the load-bearing part and
   ships first within this workstream; the presentation pieces follow.
4. **D, offline reading.** Largest, and it benefits from C being in place first.

These are separable enough to be four plans rather than one. Workstream A in
particular touches no application code and could be done by itself today.

## 12. Out of scope

Online payment collection, parent-facing receipt links, live SMS or WhatsApp
delivery through a provider, multi-campus consolidation, and the offline write
queue in section 8. None are needed to solve the five reported problems.
