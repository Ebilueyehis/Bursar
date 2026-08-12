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
