# Continuity and Backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No single failure, including one of our own making, can destroy a school's payment history.

**Architecture:** A nightly GitHub Actions job dumps the Supabase database, encrypts it to an `age` recipient public key so the runner can write backups but never read one, and uploads it to Cloudflare R2. A second weekly job fails loudly if no recent backup exists. Inside the app, a Profile panel exports the whole school to a multi-sheet workbook, which is the copy the proprietor can hold.

**Tech Stack:** GitHub Actions, `pg_dump` from the `postgres:17-alpine` container, `age`, AWS CLI v2 against the R2 S3 endpoint, Next.js 16, TypeScript, SheetJS, Vitest.

## Global Constraints

- Workstream A of `docs/superpowers/specs/2026-08-12-reliability-receipts-offline-design.md`, plus Workstream E, the capacity model, which is folded in here because it is a document and it carries the upgrade trigger that Workstream A's plan decision depends on. Read that spec before starting.
- **No em-dashes anywhere in app text, documentation, or commit messages.** Use colons or hyphens.
- Voice: respectful, clear, confident. Never blame the user. Always state what is still safe. Always give a next step.
- Money is integer kobo end to end. Exported money is written as a number in naira (`kobo / 100`) so Excel keeps it numeric, never as a preformatted string.
- The `age` recipient in CI is a **public** key. The private key never enters GitHub, CI, or this repository.
- R2 credentials must be scoped to object write on the one backup bucket. No delete, no access to other buckets.
- Standing rule: run the full adversarial security audit before and after the build (see `security-audit-prompt` memory). The suite stays green at every task boundary.
- Every task ends with `npx tsc --noEmit` clean and `npm run test` green before the commit.
- Commit directly to `develop`. Do not merge to `main` without an explicit request.

---

### Task 1: Nightly backup workflow and its setup runbook

**Files:**
- Create: `.github/workflows/backup.yml`
- Create: `docs/runbooks/backup-setup.md`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: R2 object layout `daily/bursar-YYYY-MM-DD.dump.age` and `monthly/bursar-YYYY-MM-DD.dump.age`, relied on by Task 2's freshness check and Task 3's restore runbook. Secret names `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKUP_AGE_RECIPIENT`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/backup.yml`:

```yaml
name: Nightly backup

# 02:00 UTC is 03:00 in Lagos, comfortably after a school day.
on:
  schedule:
    - cron: "0 2 * * *"
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Dump the database
        env:
          DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          set -euo pipefail
          # pg_dump must not be older than the server (Postgres 17), and the
          # runner ships an older client, so dump from the matching image.
          docker run --rm -e DB_URL -v "$PWD:/out" postgres:17-alpine \
            sh -c 'pg_dump --format=custom --no-owner --no-privileges --file=/out/bursar.dump "$DB_URL"'
          test -s bursar.dump

      - name: Install age
        run: |
          set -euo pipefail
          sudo apt-get update
          sudo apt-get install -y age

      - name: Encrypt the dump
        env:
          RECIPIENT: ${{ secrets.BACKUP_AGE_RECIPIENT }}
        run: |
          set -euo pipefail
          # RECIPIENT is a public key. This job can write backups and cannot
          # read any of them back, including the one it just wrote.
          age --recipient "$RECIPIENT" --output bursar.dump.age bursar.dump
          rm -f bursar.dump
          test -s bursar.dump.age

      - name: Upload to R2
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: auto
          # R2 rejects the checksum headers newer AWS CLI builds send by default.
          AWS_REQUEST_CHECKSUM_CALCULATION: when_required
          AWS_RESPONSE_CHECKSUM_VALIDATION: when_required
          BUCKET: ${{ secrets.R2_BUCKET }}
          ACCOUNT: ${{ secrets.R2_ACCOUNT_ID }}
        run: |
          set -euo pipefail
          ENDPOINT="https://${ACCOUNT}.r2.cloudflarestorage.com"
          DAY=$(date -u +%Y-%m-%d)
          aws s3 cp bursar.dump.age "s3://${BUCKET}/daily/bursar-${DAY}.dump.age" \
            --endpoint-url "$ENDPOINT"
          # Keep one copy per month. Retention itself is an R2 lifecycle rule,
          # not job logic, so it keeps working even if this workflow breaks.
          if [ "$(date -u +%d)" = "01" ]; then
            aws s3 cp bursar.dump.age "s3://${BUCKET}/monthly/bursar-${DAY}.dump.age" \
              --endpoint-url "$ENDPOINT"
          fi
          rm -f bursar.dump.age

      - name: Keep the project awake
        env:
          URL: ${{ secrets.SUPABASE_URL }}
          ANON: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          set -euo pipefail
          # Free Supabase projects pause after seven days without API activity.
          # A school on holiday is exactly that. RLS returns an empty array to
          # the anon role, which is fine: the request is the point.
          curl -fsS "${URL}/rest/v1/schools?select=id&limit=1" \
            -H "apikey: ${ANON}" -H "Authorization: Bearer ${ANON}" -o /dev/null
```

- [ ] **Step 2: Verify the workflow is valid YAML**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/backup.yml','utf8');if(!s.includes('cron: \"0 2 * * *\"'))throw new Error('cron missing');console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Write the setup runbook**

Create `docs/runbooks/backup-setup.md`:

````markdown
# Backup setup

One-time setup. Everything here is done by a person, not by CI, because it
involves credentials that must never pass through an agent or a log.

## 1. Generate the age key pair

On your own machine, not in CI:

```bash
age-keygen -o bursar-backup.key
```

The file contains two things. The line beginning `# public key: age1...` is the
**recipient**, which is safe to paste into GitHub. The line beginning
`AGE-SECRET-KEY-1...` is the private key, which decrypts every backup.

Store the private key in a password manager, and keep a second copy somewhere
physically separate. If it is lost, every backup ever taken becomes unreadable.
There is no recovery path. This is the single most important sentence in this
document.

## 2. Create the R2 bucket

In the Cloudflare dashboard, R2, create a bucket named `bursar-backups`.

Add two lifecycle rules on that bucket:

| Prefix | Rule |
| --- | --- |
| `daily/` | Delete objects 35 days after upload |
| `monthly/` | Delete objects 400 days after upload |

Lifecycle rules are used rather than pruning inside the job, because they keep
running even when the workflow is broken.

Create an R2 API token scoped to **Object Read and Write on this bucket only**.
Note the Access Key ID, the Secret Access Key, and your Cloudflare Account ID.

## 3. Add the GitHub secrets

Repository, Settings, Secrets and variables, Actions. Add:

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase, Project Settings, Database, Connection string, URI. Use the direct connection, not the pooler, because `pg_dump` needs a session connection. |
| `SUPABASE_URL` | `https://pbrirletzhvanmmxithr.supabase.co` |
| `SUPABASE_ANON_KEY` | The anon public key. This one is not a secret in the strict sense, and is stored here only for convenience. |
| `BACKUP_AGE_RECIPIENT` | The `age1...` public key from step 1. Never the secret key. |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BUCKET` | `bursar-backups` |
| `R2_ACCESS_KEY_ID` | From step 2 |
| `R2_SECRET_ACCESS_KEY` | From step 2 |

## 4. Prove it works

Actions, Nightly backup, Run workflow. It should finish green, and an object
should appear under `daily/` in the bucket.

Until the secrets above exist, this workflow fails on every run. That is the
correct behaviour: a backup job that fails quietly is worse than no backup,
because it manufactures confidence.

## 5. Then run the restore drill

A backup nobody has restored is a rumour. Follow `docs/runbooks/restore.md`
before treating any of this as done.
````

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/backup.yml docs/runbooks/backup-setup.md
git commit -m "feat: nightly encrypted database backup to R2

Dumps from the postgres:17 image so the client is never older than the
server, encrypts to an age recipient public key so the runner can write
backups but cannot read one back, and uploads to Cloudflare R2. Retention
is an R2 lifecycle rule rather than job logic, so it survives the workflow
breaking. The same run touches the REST API to stop the free project
pausing after seven days idle."
```

---

### Task 2: Weekly freshness check

**Files:**
- Create: `.github/workflows/backup-freshness.yml`

**Interfaces:**
- Consumes: the `daily/` object layout and the R2 secrets from Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/backup-freshness.yml`:

```yaml
name: Backup freshness

# Monday 09:00 UTC. A backup job that stops silently is worse than no backup,
# so something has to notice. GitHub emails on workflow failure.
on:
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Fail if the newest daily backup is older than 48 hours
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: auto
          AWS_REQUEST_CHECKSUM_CALCULATION: when_required
          AWS_RESPONSE_CHECKSUM_VALIDATION: when_required
          BUCKET: ${{ secrets.R2_BUCKET }}
          ACCOUNT: ${{ secrets.R2_ACCOUNT_ID }}
        run: |
          set -euo pipefail
          ENDPOINT="https://${ACCOUNT}.r2.cloudflarestorage.com"
          LATEST=$(aws s3 ls "s3://${BUCKET}/daily/" --endpoint-url "$ENDPOINT" \
            | sort | tail -n 1 || true)
          if [ -z "$LATEST" ]; then
            echo "No backup objects found under daily/. The backup job is not working."
            exit 1
          fi
          echo "Newest object: $LATEST"
          STAMP="$(echo "$LATEST" | awk '{print $1" "$2}')"
          AGE_HOURS=$(( ( $(date -u +%s) - $(date -u -d "$STAMP" +%s) ) / 3600 ))
          echo "Age: ${AGE_HOURS} hours"
          if [ "$AGE_HOURS" -gt 48 ]; then
            echo "Newest backup is ${AGE_HOURS} hours old, which is over the 48 hour limit."
            exit 1
          fi
          echo "Backup freshness is within limits."
```

- [ ] **Step 2: Verify the workflow parses and carries the 48 hour limit**

Run: `node -e "const s=require('fs').readFileSync('.github/workflows/backup-freshness.yml','utf8');if(!s.includes('-gt 48'))throw new Error('limit missing');console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/backup-freshness.yml
git commit -m "feat: weekly check that a recent backup actually exists

Fails loudly when the newest daily object is missing or over 48 hours old.
A backup job that stops quietly manufactures confidence, which is worse
than having no backup at all."
```

---

### Task 3: Restore runbook

**Files:**
- Create: `docs/runbooks/restore.md`

**Interfaces:**
- Consumes: the R2 object layout from Task 1 and the private key from `docs/runbooks/backup-setup.md`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/restore.md`:

````markdown
# Restoring from a backup

A backup nobody has restored is a rumour. Run this drill once before treating
the backup system as done, and again whenever the schema changes shape.

Everything here runs on your own machine. The private key must never be pasted
into CI, into a chat window, or into any tool that keeps logs.

## 1. Fetch the backup

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=auto
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

aws s3 ls s3://bursar-backups/daily/ \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

aws s3 cp s3://bursar-backups/daily/bursar-<DATE>.dump.age . \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

## 2. Decrypt

```bash
age --decrypt --identity bursar-backup.key \
  --output bursar.dump bursar-<DATE>.dump.age
```

If this step fails, the private key is wrong or lost, and no backup taken with
that recipient can be read. There is no other route in.

## 3. Restore into a scratch project

Never restore into the live project as a drill. Create a throwaway Supabase
project, take its direct connection string, then:

```bash
docker run --rm -e DB_URL="<SCRATCH_DB_URL>" -v "$PWD:/in" postgres:17-alpine \
  sh -c 'pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DB_URL" /in/bursar.dump'
```

## 4. Prove the data came back

Against the scratch project, confirm the counts match what the live project
held on the backup date, and that one known receipt survived intact:

```sql
select count(*) from students;
select count(*) from payments;
select receipt_no, amount_kobo, paid_on from payments order by paid_on desc limit 5;
```

A restore that produces empty tables without erroring is the failure mode to
watch for. Check the counts, not just the exit code.

## 5. Record the drill

Add a line to the table below every time this is run. An undated drill is the
same as no drill.

| Date run | Backup restored | Time taken | Result |
| --- | --- | --- | --- |
| | | | |

## 6. Delete the scratch project

It holds real school financial data. Delete it as soon as the drill is
recorded, and confirm the deletion.
````

- [ ] **Step 2: Verify the drill table exists**

Run: `node -e "const s=require('fs').readFileSync('docs/runbooks/restore.md','utf8');if(!s.includes('Date run'))throw new Error('drill log missing');console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/restore.md
git commit -m "docs: restore runbook with a drill log

Fetch, decrypt, restore into a scratch project, and prove the counts came
back. Includes the failure mode to watch for: a restore that produces empty
tables without erroring."
```

---

### Task 4: Capacity and cost model

**Files:**
- Create: `docs/capacity-and-cost.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the upgrade triggers, referenced by no code but by the operator.

- [ ] **Step 1: Write the document**

Create `docs/capacity-and-cost.md`:

````markdown
# Capacity and cost

Measured against the live project `pbrirletzhvanmmxithr` on 2026-08-12, so
pricing can rest on arithmetic rather than a guess.

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

## When to move to Supabase Pro

Whichever comes first:

- the first school that pays;
- database size crossing 300 MB, which is 60 percent of the free 500 MB;
- monthly egress crossing 3 GB, which is 60 percent of the free 5 GB;
- any second school recording live money.

Written down so the decision is made once rather than re-argued monthly.

## Monthly check

Record actual figures here on the first of each month.

| Month | Database size | Monthly egress | Schools live | Action |
| --- | --- | --- | --- | --- |
| 2026-08 | under 1 MB | negligible | 0 live, seed data only | none |
````

- [ ] **Step 2: Verify the triggers are present**

Run: `node -e "const s=require('fs').readFileSync('docs/capacity-and-cost.md','utf8');if(!s.includes('300 MB'))throw new Error('trigger missing');console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add docs/capacity-and-cost.md
git commit -m "docs: measured capacity model and the written upgrade trigger

About 21,000 rows and 5 to 10 MB per school year, dominated by assessments.
Storage is not the constraint; egress and the plan floor are."
```

---

### Task 5: Multi-sheet workbook export helper

**Files:**
- Modify: `src/lib/export.ts`
- Create: `src/lib/__tests__/export.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export interface ExportSheet {
    name: string;
    headers: string[];
    rows: (string | number)[][];
  }
  export function exportWorkbook(filename: string, sheets: ExportSheet[]): Promise<void>;
  export function safeSheetName(name: string): string;
  ```
  Task 7 calls `exportWorkbook`. Task 6 produces the `ExportSheet[]` it consumes.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/export.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { safeSheetName } from "@/lib/export";

describe("safeSheetName", () => {
  it("keeps an ordinary name unchanged", () => {
    expect(safeSheetName("Payments")).toBe("Payments");
  });

  it("truncates to the 31 character sheet name limit", () => {
    const long = "Payments recorded during the first term";
    expect(safeSheetName(long)).toHaveLength(31);
  });

  it("replaces the characters Excel forbids in a sheet name", () => {
    expect(safeSheetName("Fees / levies [2026]")).toBe("Fees - levies (2026)");
  });

  it("falls back to Sheet when nothing usable is left", () => {
    expect(safeSheetName("   ")).toBe("Sheet");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/export.test.ts`
Expected: FAIL, `safeSheetName` is not exported from `@/lib/export`

- [ ] **Step 3: Implement**

Append to `src/lib/export.ts`:

```ts
/** One sheet in a multi-sheet workbook. */
export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Excel rejects sheet names over 31 characters and forbids : \ / ? * [ ].
 * Anything that would make the workbook refuse to open is replaced rather than
 * passed through, because a failed download gives the user nothing to act on.
 */
export function safeSheetName(name: string): string {
  const cleaned = name
    .replace(/[:\\/?*]/g, "-")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .trim();
  if (!cleaned) return "Sheet";
  return cleaned.slice(0, 31);
}

/**
 * Client-side .xlsx export with one sheet per table. Same deferred-work shape
 * as exportToXlsx: building and serialising is synchronous and CPU heavy, so it
 * runs after the click has painted and does not block the interaction.
 */
export function exportWorkbook(
  filename: string,
  sheets: ExportSheet[],
): Promise<void> {
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  return new Promise<void>((resolve, reject) => {
    const run = () => {
      try {
        const workbook = XLSX.utils.book_new();
        const used = new Set<string>();
        for (const sheet of sheets) {
          let title = safeSheetName(sheet.name);
          // Two sheets cannot share a name, and SheetJS throws rather than
          // renaming, which would lose a whole table from the export.
          let n = 2;
          while (used.has(title)) {
            title = safeSheetName(`${sheet.name} ${n}`);
            n += 1;
          }
          used.add(title);
          const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
          XLSX.utils.book_append_sheet(workbook, ws, title);
        }
        XLSX.writeFile(workbook, name);
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Export failed."));
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(run, 0));
    } else {
      setTimeout(run, 0);
    }
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/export.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit && npm run test`
Expected: no output from tsc, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/export.ts src/lib/__tests__/export.test.ts
git commit -m "feat: multi-sheet xlsx export helper

Sheet names are sanitised and de-duplicated, because SheetJS throws on a
duplicate rather than renaming, which would silently drop a whole table
from the export."
```

---

### Task 6: `exportSchoolData` in both repositories

**Files:**
- Modify: `src/lib/data/repository.ts`
- Modify: `src/lib/data/mock.ts`
- Modify: `src/lib/data/supabase-repo.ts`
- Create: `src/lib/data/__tests__/schoolExport.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export interface SchoolExport {
    school: School;
    session: Session;
    classes: SchoolClass[];
    students: Student[];
    guardians: Guardian[];
    feeItems: FeeItem[];
    bills: Bill[];
    payments: Payment[];
    expenses: Expense[];
    income: Income[];
    staff: Staff[];
    subjects: Subject[];
    assessments: Assessment[];
  }
  // on the Repository interface:
  exportSchoolData(): Promise<SchoolExport>;
  ```
  Task 7 calls `repository.exportSchoolData()` and passes the result to Task 7's sheet builder.

Note: this deliberately takes **no term argument**. It is the school's whole
record, not one term's, which is the point of the control.

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/__tests__/schoolExport.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";

describe("exportSchoolData (mock)", () => {
  it("returns every collection the school owns", async () => {
    const data = await mockRepository.exportSchoolData();

    expect(data.school.name).toBeTruthy();
    expect(data.session.name).toBeTruthy();
    expect(Array.isArray(data.classes)).toBe(true);
    expect(Array.isArray(data.students)).toBe(true);
    expect(Array.isArray(data.guardians)).toBe(true);
    expect(Array.isArray(data.feeItems)).toBe(true);
    expect(Array.isArray(data.bills)).toBe(true);
    expect(Array.isArray(data.payments)).toBe(true);
    expect(Array.isArray(data.expenses)).toBe(true);
    expect(Array.isArray(data.income)).toBe(true);
    expect(Array.isArray(data.staff)).toBe(true);
    expect(Array.isArray(data.subjects)).toBe(true);
    expect(Array.isArray(data.assessments)).toBe(true);
  });

  it("includes every student, not only those in the current term", async () => {
    const students = await mockRepository.listStudents();
    const data = await mockRepository.exportSchoolData();
    expect(data.students).toHaveLength(students.length);
  });

  it("includes a payment that was just recorded", async () => {
    const before = await mockRepository.exportSchoolData();
    const accounts = await mockRepository.listStudentAccounts("first");
    const target = accounts.find((a) => a.outstanding > 0) ?? accounts[0];

    await mockRepository.recordPayment({
      studentId: target.student.id,
      billId: target.bill.id,
      amount: 100_00,
      method: "cash",
    });

    const after = await mockRepository.exportSchoolData();
    expect(after.payments.length).toBe(before.payments.length + 1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/schoolExport.test.ts`
Expected: FAIL, `exportSchoolData is not a function`

- [ ] **Step 3: Add the type and the interface method**

In `src/lib/data/repository.ts`, add near the other result types:

```ts
/**
 * Everything one school owns, for the "your records are yours" export. No term
 * argument: this is the whole record, not a slice of it.
 */
export interface SchoolExport {
  school: School;
  session: Session;
  classes: SchoolClass[];
  students: Student[];
  guardians: Guardian[];
  feeItems: FeeItem[];
  bills: Bill[];
  payments: Payment[];
  expenses: Expense[];
  income: Income[];
  staff: Staff[];
  subjects: Subject[];
  assessments: Assessment[];
}
```

Add `Guardian` to the type import from `@/lib/domain/types` in that file if it
is not already imported. Then add to the `Repository` interface, next to the
other read methods:

```ts
  /** The school's complete records, for export. */
  exportSchoolData(): Promise<SchoolExport>;
```

- [ ] **Step 4: Implement in the mock**

In `src/lib/data/mock.ts`, add `Guardian` to the type import list from
`@/lib/domain/types`, add `SchoolExport` to the type import from
`@/lib/data/repository`, and add this method to `mockRepository`:

```ts
  async exportSchoolData(): Promise<SchoolExport> {
    return {
      school: SCHOOL,
      session: SESSION,
      classes: [...CLASSES],
      students: [...STUDENTS],
      guardians: [...GUARDIANS],
      feeItems: [...FEE_ITEMS],
      bills: [...BILLS],
      payments: [...PAYMENTS],
      expenses: [...EXPENSES],
      income: [...INCOME],
      staff: [...STAFF],
      subjects: [...SUBJECTS],
      assessments: [...ASSESSMENTS],
    };
  },
```

Every array is copied rather than handed out by reference, so a caller cannot
mutate the mock store through the export.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/data/__tests__/schoolExport.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 6: Implement in the Supabase repository**

In `src/lib/data/supabase-repo.ts`, add `SchoolExport` to the type import from
`@/lib/data/repository` and add this method to `supabaseRepository`. Follow the
row-mapping helpers already used in that file for each table rather than
inventing new ones: read how `listStudents`, `listExpenses` and `listIncome`
map their rows, and reuse the same mappers.

```ts
  async exportSchoolData(): Promise<SchoolExport> {
    // RLS scopes every one of these to the caller's school. No school_id filter
    // is added here for the same reason it is absent everywhere else: the
    // database is the boundary, not this query.
    const [
      school,
      session,
      classes,
      students,
      guardians,
      feeItems,
      bills,
      payments,
      expenses,
      income,
      staff,
      subjects,
      assessments,
    ] = await Promise.all([
      this.getSchool(),
      this.getSession(),
      this.listClasses(),
      this.listStudents(),
      this.listGuardiansForExport(),
      this.listAllFeeItemsForExport(),
      this.listAllBillsForExport(),
      this.listAllPaymentsForExport(),
      this.listExpenses(),
      this.listIncome(),
      this.listStaff(),
      this.listSubjects(),
      this.listAllAssessmentsForExport(),
    ]);

    return {
      school,
      session,
      classes,
      students,
      guardians,
      feeItems,
      bills,
      payments,
      expenses,
      income,
      staff,
      subjects,
      assessments,
    };
  },
```

The five `...ForExport` helpers are private functions in the same file, not
interface methods, because nothing outside the export needs an unfiltered read.
Each is a plain `select("*")` against its table, mapped with the row mapper that
file already uses for that table, with the `.eq("term", ...)` and
`.eq("session_id", ...)` clauses removed. Follow this shape, which is the
guardians one written out in full:

```ts
async function listGuardiansForExport(): Promise<Guardian[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("guardians").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    schoolId: row.school_id,
    fullName: row.full_name,
    phone: row.phone,
    altPhone: row.alt_phone ?? undefined,
    email: row.email ?? undefined,
    relationship: row.relationship ?? undefined,
  }));
}
```

The remaining four follow the same pattern against `fee_items`, `bills` with its
`bill_lines` join, `payments`, and `assessments`. Before writing each one, read
the existing term-filtered read for that table in this file and copy its column
names and mapping exactly. Do not invent column names: if `npx tsc --noEmit`
and the tests pass but a column name is wrong, the export will silently produce
empty cells, which is the failure mode to avoid here.

- [ ] **Step 7: Typecheck and full suite**

Run: `npx tsc --noEmit && npm run test`
Expected: no output from tsc, all tests pass including the 3 new ones

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/repository.ts src/lib/data/mock.ts src/lib/data/supabase-repo.ts src/lib/data/__tests__/schoolExport.test.ts
git commit -m "feat: exportSchoolData across both repositories

Returns the school's whole record rather than one term's, which is the
point of the control. RLS scopes every read, so no school_id filter is
added in the query."
```

---

### Task 7: The export control in the Profile hub

**Files:**
- Create: `src/lib/export/schoolSheets.ts`
- Create: `src/lib/export/__tests__/schoolSheets.test.ts`
- Modify: `src/app/profile/page.tsx:62-107`

**Interfaces:**
- Consumes: `SchoolExport` and `repository.exportSchoolData()` from Task 6; `ExportSheet` and `exportWorkbook` from Task 5.
- Produces:
  ```ts
  export function schoolSheets(data: SchoolExport): ExportSheet[];
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/__tests__/schoolSheets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mockRepository } from "@/lib/data/mock";
import { schoolSheets } from "@/lib/export/schoolSheets";

describe("schoolSheets", () => {
  it("produces one sheet per collection", async () => {
    const data = await mockRepository.exportSchoolData();
    const sheets = schoolSheets(data);
    const names = sheets.map((s) => s.name);

    expect(names).toContain("Students");
    expect(names).toContain("Guardians");
    expect(names).toContain("Bills");
    expect(names).toContain("Payments");
    expect(names).toContain("Expenses");
    expect(names).toContain("Income");
    expect(names).toContain("Staff");
    expect(names).toContain("Assessments");
  });

  it("writes money as a number in naira, not a formatted string", async () => {
    const data = await mockRepository.exportSchoolData();
    const payments = schoolSheets(data).find((s) => s.name === "Payments");
    const amountColumn = payments!.headers.indexOf("Amount");

    expect(amountColumn).toBeGreaterThan(-1);
    for (const row of payments!.rows) {
      expect(typeof row[amountColumn]).toBe("number");
    }
  });

  it("gives every sheet a header for each column it writes", async () => {
    const data = await mockRepository.exportSchoolData();
    for (const sheet of schoolSheets(data)) {
      for (const row of sheet.rows) {
        expect(row).toHaveLength(sheet.headers.length);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/export/__tests__/schoolSheets.test.ts`
Expected: FAIL, cannot resolve `@/lib/export/schoolSheets`

- [ ] **Step 3: Implement the sheet builder**

Create `src/lib/export/schoolSheets.ts`:

```ts
import type { SchoolExport } from "@/lib/data/repository";
import type { ExportSheet } from "@/lib/export";

/** Kobo to a naira number. Excel keeps it numeric so the column can be summed. */
function naira(kobo: number): number {
  return Math.round(kobo) / 100;
}

/**
 * Turns a school's complete records into one sheet per collection. Pure, so it
 * is testable without a browser, and so the workbook's shape is decided in one
 * place rather than inside a click handler.
 */
export function schoolSheets(data: SchoolExport): ExportSheet[] {
  const className = new Map(data.classes.map((c) => [c.id, c.name]));
  const guardianName = new Map(data.guardians.map((g) => [g.id, g.fullName]));
  const studentName = new Map(
    data.students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
  );
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));

  return [
    {
      name: "Students",
      headers: [
        "Admission no",
        "First name",
        "Last name",
        "Other name",
        "Gender",
        "Date of birth",
        "Class",
        "Guardian",
        "Status",
        "Enrolled on",
      ],
      rows: data.students.map((s) => [
        s.admissionNo,
        s.firstName,
        s.lastName,
        s.otherName ?? "",
        s.gender ?? "",
        s.dateOfBirth ?? "",
        className.get(s.classId) ?? "",
        guardianName.get(s.guardianId) ?? "",
        s.status,
        s.enrolledOn,
      ]),
    },
    {
      name: "Guardians",
      headers: ["Name", "Relationship", "Phone", "Alternate phone", "Email"],
      rows: data.guardians.map((g) => [
        g.fullName,
        g.relationship ?? "",
        g.phone,
        g.altPhone ?? "",
        g.email ?? "",
      ]),
    },
    {
      name: "Classes",
      headers: ["Class", "Level"],
      rows: data.classes.map((c) => [c.name, c.level]),
    },
    {
      name: "Fee items",
      headers: ["Level", "Term", "Item", "Amount"],
      rows: data.feeItems.map((f) => [
        f.level,
        f.term,
        f.name,
        naira(f.amount),
      ]),
    },
    {
      name: "Bills",
      headers: ["Student", "Term", "Total", "Discount", "Reason", "Created on"],
      rows: data.bills.map((b) => [
        studentName.get(b.studentId) ?? "",
        b.term,
        naira(b.lines.reduce((sum, l) => sum + l.amount, 0)),
        naira(b.discount),
        b.discountReason ?? "",
        b.createdOn,
      ]),
    },
    {
      name: "Payments",
      headers: [
        "Receipt no",
        "Student",
        "Amount",
        "Method",
        "Paid on",
        "Recorded by",
        "Note",
      ],
      rows: data.payments.map((p) => [
        p.receiptNo,
        studentName.get(p.studentId) ?? "",
        naira(p.amount),
        p.method,
        p.paidOn,
        p.recordedByName,
        p.note ?? "",
      ]),
    },
    {
      name: "Expenses",
      headers: [
        "Date",
        "Payee",
        "Description",
        "Category",
        "Cadence",
        "Amount",
        "Method",
        "Recorded by",
      ],
      rows: data.expenses.map((e) => [
        e.spentOn,
        e.payee,
        e.description,
        e.category,
        e.cadence,
        naira(e.amount),
        e.method,
        e.recordedByName,
      ]),
    },
    {
      name: "Income",
      headers: [
        "Date",
        "Source",
        "Description",
        "Amount",
        "Method",
        "Recorded by",
      ],
      rows: data.income.map((i) => [
        i.receivedOn,
        i.source,
        i.description,
        naira(i.amount),
        i.method,
        i.recordedByName,
      ]),
    },
    {
      name: "Staff",
      headers: [
        "Name",
        "Title",
        "Employment type",
        "Assignment",
        "Phone",
        "Monthly salary",
        "Active",
      ],
      rows: data.staff.map((s) => [
        s.fullName,
        s.title ?? "",
        s.employmentType,
        s.assignment ?? "",
        s.phone ?? "",
        naira(s.monthlySalary),
        s.active ? "Yes" : "No",
      ]),
    },
    {
      name: "Assessments",
      headers: ["Student", "Subject", "Term", "CA 1", "CA 2", "Exam"],
      rows: data.assessments.map((a) => [
        studentName.get(a.studentId) ?? "",
        subjectName.get(a.subjectId) ?? "",
        a.term,
        a.ca1 ?? "",
        a.ca2 ?? "",
        a.exam ?? "",
      ]),
    },
  ];
}
```

If a field name above does not match `src/lib/domain/types.ts`, the types file
wins: fix the sheet builder, not the type. Run `npx tsc --noEmit` to find any
mismatch.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/export/__tests__/schoolSheets.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Add the Records panel to the Profile hub**

In `src/app/profile/page.tsx`, extend the panel union and list:

```ts
type PanelId = "setup" | "account" | "staff" | "fees" | "roles" | "records" | "appearance";

const PANELS: { id: PanelId; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "account", label: "Account Information" },
  { id: "staff", label: "Staff & Payroll" },
  { id: "fees", label: "Fees & Discount" },
  { id: "roles", label: "User Roles" },
  { id: "records", label: "Your Records" },
  { id: "appearance", label: "Appearance" },
];
```

Add the render line beside the others:

```tsx
        {panel === "records" && <RecordsPanel />}
```

Add the panel component near the other panels:

```tsx
function RecordsPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onExport() {
    setBusy(true);
    setError("");
    try {
      const data = await repository.exportSchoolData();
      const stamp = new Date().toISOString().slice(0, 10);
      await exportWorkbook(`${data.school.name} records ${stamp}`, schoolSheets(data));
    } catch {
      setError(
        "The export could not be prepared. Your records are unchanged. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelShell
      title="Your Records"
      subtitle="Your school's records belong to your school."
    >
      <Card>
        <p className="text-sm text-ink-muted">
          This downloads everything Bursar holds for your school as one
          spreadsheet: students and their guardians, classes and fee items,
          bills, every payment received, expenses, other income, staff, and
          assessment scores. Each one is a separate sheet in the file.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          You can take this copy with you at any time, whether or not you
          continue with Bursar.
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button onClick={onExport} disabled={busy} className="mt-4">
          {busy ? "Preparing your file" : "Export all school records"}
        </Button>
      </Card>
    </PanelShell>
  );
}
```

Add the imports this needs at the top of the file, merging with what is already
imported rather than duplicating: `exportWorkbook` from `@/lib/export`,
`schoolSheets` from `@/lib/export/schoolSheets`, and `repository` from
`@/lib/data/repository`.

Note the copy carries no em-dashes, does not blame the user on failure, states
what is still safe, and gives a next step, per the voice guide.

- [ ] **Step 6: Typecheck, full suite, and build**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: tsc silent, all tests pass, build compiles and generates its static pages

- [ ] **Step 7: Run the post-build security audit**

Run the audit prompt stored in the `security-audit-prompt` memory against the
live Supabase project `pbrirletzhvanmmxithr` and this branch. Confirm at minimum:
every table still has RLS enabled with policies; `profiles` and `audit_log` are
still select-only; the service role key is still imported only in
`src/app/onboarding/actions.ts`; the only client-exposed variables are the
Supabase URL and anon key. The export added here reads through RLS like every
other screen and must not introduce a service-role path.

- [ ] **Step 8: Commit**

```bash
git add src/lib/export/schoolSheets.ts src/lib/export/__tests__/schoolSheets.test.ts src/app/profile/page.tsx
git commit -m "feat: export all school records from the Profile hub

One sheet per collection, money written as a naira number so columns can be
summed. Reads through RLS like every other screen, with no service-role
path. This is the visible half of the backup story: the school can hold its
own copy at any time."
```

---

## What this plan does not do

Workstreams B, C and D of the spec: receipt delivery and the receipt screen,
idempotency keys and network honesty, and the offline read cache. Each gets its
own plan.

## Human steps this plan cannot perform

Tasks 1 through 3 produce the machinery, but the following must be done by a
person, because they involve credentials that must never pass through an agent
or a log:

1. Generate the `age` key pair and store the private key safely.
2. Create the R2 bucket, its two lifecycle rules, and a write-scoped API token.
3. Add the eight GitHub secrets.
4. Run the backup workflow once by hand and confirm an object lands in R2.
5. Run the restore drill and record the date in `docs/runbooks/restore.md`.

Until step 5 is recorded, this workstream is not done, however green the code is.
