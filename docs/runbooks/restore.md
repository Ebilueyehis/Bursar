# Restoring from a backup

A backup nobody has restored is a rumour. Run this drill once before treating
the backup system as done, and again whenever the schema changes shape.

Everything here runs on your own machine. The private key must never be pasted
into CI, into a chat window, or into any tool that keeps logs.

## 1. Fetch the backup

Storage is Backblaze B2 (see `docs/runbooks/backup-setup.md` for why it is
not Cloudflare R2). `<REGION>` is the segment from the bucket's endpoint,
e.g. `us-west-004` — find it in the B2 console under the bucket's details.

```bash
export AWS_ACCESS_KEY_ID=...        # the B2 application key's keyID
export AWS_SECRET_ACCESS_KEY=...    # the B2 application key's applicationKey
export AWS_DEFAULT_REGION=<REGION>
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

aws s3 ls s3://bursar-backups/daily/ \
  --endpoint-url https://s3.<REGION>.backblazeb2.com

aws s3 cp s3://bursar-backups/daily/bursar-<DATE>.dump.age . \
  --endpoint-url https://s3.<REGION>.backblazeb2.com
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
project, then restore with `pg_restore` version 17 or newer — it must not be
older than the Postgres 17 the dump came from, same reasoning as the backup
job's own `pg_dump`. This is the only real requirement; everything else below
is just how to satisfy it.

For `<SCRATCH_DB_URL>`, use the scratch project's **direct connection
string** if your network gives you IPv6 (most home and office connections
do); if it times out, use its **session pooler** string instead (same shape
CI uses, guaranteed to work over IPv4) — both hold a session, which
`pg_restore` needs.

**Native client (recommended — nothing to run in the background, nothing
Windows-specific to fight with):**

Install PostgreSQL 17's client tools once, then this is a single command
with no containers, no daemons, and no volume-mount path quoting to get
wrong:

| OS | Install |
| --- | --- |
| macOS | `brew install postgresql@17` |
| Windows | The [postgresql.org Windows installer](https://www.postgresql.org/download/windows/) — uncheck everything except "Command Line Tools" if you don't want the full server |
| Linux | `sudo apt install postgresql-client-17` (Debian/Ubuntu), or your distro's equivalent |

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="<SCRATCH_DB_URL>" bursar.dump
```

**Docker (alternative, if you already have it running and prefer not to
install anything locally):**

```bash
docker run --rm -e DB_URL="<SCRATCH_DB_URL>" -v "$PWD:/in" postgres:17-alpine \
  sh -c 'pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DB_URL" /in/bursar.dump'
```

Needs Docker Desktop actually running first (on Windows, its WSL2 backend
too) — confirm `docker ps` returns cleanly before trying this, rather than
debugging the restore command when the real problem is the daemon.

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
