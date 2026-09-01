# Backup setup

One-time setup. Everything here is done by a person, not by CI, because it
involves credentials that must never pass through an agent or a log.

Storage is **Backblaze B2**, not Cloudflare R2. R2 was the original choice;
it was dropped after repeated Cloudflare dashboard outages blocked setup with
no workaround, on a system that was supposed to make outages someone else's
problem. B2 is a separate account with its own auth, so an outage on one
never blocks the other. See `docs/backlog.md` for the record of that switch.

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

## 2. Create the B2 bucket and an application key

1. Sign up at [backblaze.com](https://www.backblaze.com/) if you have not
   already, and open the B2 Cloud Storage console.
2. Create a bucket named `bursar-backups`, set **Private**.
3. Open the bucket's details and note its **Endpoint**, shown as something
   like `s3.us-west-004.backblazeb2.com`. The part between `s3.` and
   `.backblazeb2.com` (`us-west-004` in that example) is your **region** —
   B2 assigns this per account, and every bucket on the account shares it.
4. Under **App Keys**, create a new application key:
   - Name it `bursar-backups-ci`.
   - Restrict it to the `bursar-backups` bucket only.
   - Allow **Read and Write**.
   - Tick **Allow listAllBucketNames** — the S3-compatible API needs this
     even for a bucket-restricted key, or the AWS CLI's own startup checks
     fail before your first `s3 cp`.
5. Note the **keyID** and **applicationKey** shown once, at creation. The
   application key is not retrievable again after you leave the page.
6. Add two lifecycle rules on the bucket (**Lifecycle Settings**). B2's model
   is two-step, not a direct "delete after N days" like R2's: a rule hides a
   file N days after upload, then deletes it a further N days after being
   hidden. Since every backup object has a unique, date-stamped name (never
   overwritten), nothing hides it automatically, so set both fields on
   purpose:

   | File name prefix | Days from uploading to hiding | Days from hiding to deleting |
   | --- | --- | --- |
   | `daily/` | 35 | 1 |
   | `monthly/` | 400 | 1 |

   This deletes a `daily/` object 36 days after upload and a `monthly/`
   object 401 days after upload — one day later than R2's rule gave, which is
   immaterial here. Lifecycle rules are used rather than pruning inside the
   job, because they keep running even when the workflow is broken.

## 3. Add the GitHub secrets

Repository, Settings, Secrets and variables, Actions. Add:

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase, Project Settings, Database, Connection string. Use the **Session pooler** string, port 5432, host `aws-0-<region>.pooler.supabase.com`. See the note below: this is not the obvious choice and the obvious choice does not work. |
| `SUPABASE_URL` | `https://pbrirletzhvanmmxithr.supabase.co` |
| `SUPABASE_ANON_KEY` | The anon public key. This one is not a secret in the strict sense, and is stored here only for convenience. |
| `BACKUP_AGE_RECIPIENT` | The `age1...` public key from step 1. Never the secret key. |
| `B2_KEY_ID` | The application key's **keyID**, from step 2 |
| `B2_APPLICATION_KEY` | The application key's **applicationKey**, from step 2 |
| `B2_BUCKET` | `bursar-backups` |
| `B2_REGION` | The region from the bucket's endpoint, e.g. `us-west-004` — not the full endpoint URL, just that segment |

If secrets from an earlier R2 setup attempt exist (`R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`), delete them. The
workflows no longer read them, and a stray secret with no reader is a thing
someone will spend an hour investigating in a year.

### Which connection string, and why it matters

Supabase offers three, and only one of them works here.

| Option | Port | Verdict |
| --- | --- | --- |
| Direct connection | 5432 | **Will not work.** On the free plan this resolves to IPv6 only, and GitHub-hosted runners have no IPv6. The job fails with a connection timeout that looks like a firewall problem and is not. |
| Transaction pooler | 6543 | **Will not work.** `pg_dump` needs a session, and transaction mode does not give it one. |
| Session pooler | 5432 | **Use this one.** Reachable over IPv4 and holds a session, which is what `pg_dump` needs. |

## 4. Scheduled runs only fire from the default branch

GitHub only runs `schedule` triggers, and only offers the Run workflow button,
for workflows on the repository's **default branch**. These files live on
`develop`. Until they are merged to `main`, the nightly job will never fire and
the manual button will not appear.

Merge to `main` before expecting a backup.

## 5. Prove it works

Actions, Nightly backup, Run workflow. It should finish green, and an object
should appear under `daily/` in the bucket.

Until the secrets above exist, this workflow fails on every run. That is the
correct behaviour: a backup job that fails quietly is worse than no backup,
because it manufactures confidence.

## 6. Then run the restore drill

A backup nobody has restored is a rumour. Follow `docs/runbooks/restore.md`
before treating any of this as done.
