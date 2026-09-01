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
