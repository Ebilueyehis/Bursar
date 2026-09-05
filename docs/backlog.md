# Backlog

Every suggestion, tweak, bug and "we should probably" lands here the moment it
is spoken. Nothing is too small. An idea that lives only in a chat window is
lost, and the cost is paying to rediscover it months later.

**Status:** `idea` (raised, not decided) · `agreed` (we will do it, unscheduled) ·
`specced` (design written) · `planned` (task-by-task plan written) · `building` ·
`done` (drop it from this file, it is in the PRD now) · `rejected` (keep it, with
the reason).

**Size:** `S` under a day · `M` a few days · `L` a week or more.

Rejected items stay in the file. Knowing something was considered and turned
down, and why, is worth as much as knowing what was built.

---

## Now

| Item | Size | Status | Notes |
| --- | --- | --- | --- |
| Platform admin panel: view every school + metrics, read-only | M | building | Merged into `develop`. `/platform-admin`, gated on `platform_admins` allowlist via the admin client; RLS untouched (diff on `schema.sql` is a pure addition). Spec: `docs/superpowers/specs/2026-08-25-platform-admin-panel-design.md`. Plan: `docs/superpowers/plans/2026-08-25-platform-admin-panel.md`. Not yet verified live: the schema change hasn't been applied to the Supabase project and nobody has an admin row yet, so the page has never been clicked through in a browser. Stays out of `main` until that's done. Move to `done` and drop from this file once verified, since the PRD entry already covers it. |
| Restore drill, dated in the log | S | building | Nightly backup confirmed green end to end 2026-09-02 (Backblaze B2 upload and keep-alive both pass; a real dated object exists in `daily/`), so this is the one step left before the backup counts as real rather than machinery. Steps in `docs/runbooks/restore.md`; record the drill in its log table when run. |
| Run the sales kit prompt sequence | M | agreed | `docs/sales-kit/prompt-sequence.md`. No engineering. Blocked only on the nine values to fill in. |

## Next

| Item | Size | Status | Notes |
| --- | --- | --- | --- |
| Workstream B: receipt delivery and receipt screen | M | specced | Share sheet into WhatsApp, printer kept as one option, popups deleted. Needs a plan. |
| Workstream C: idempotency and network honesty | M | specced | Idempotency key is the load-bearing part; the rest is presentation. |
| Workstream D: offline reading | L | specced | Cache decorator around the repository. Tenant-scoped keys are the security-critical part. |
| Live SMS and WhatsApp delivery | M | agreed | Termii adapter exists; the app has no API routes at all, so a composed reminder has nowhere to go. |

## Later

| Item | Size | Status | Notes |
| --- | --- | --- | --- |
| Platform admin: manage school/account state (suspend, edit pilot status) | M | idea | Deferred out of the v1 admin panel spec. `schools` has no status/billing columns yet; needs its own design once a second pilot school exists to shape it against. |
| Platform admin: impersonate a school login for support | L | idea | Deferred out of the v1 admin panel spec: a platform admin acting inside a school's real financial data under another identity is a different, larger threat model (audit trail, session scope, school-side visibility) and needs its own spec. |
| Configurable assessment maxes | S | agreed | CA1 20, CA2 20, Exam 60 are fixed in `src/lib/records/grading.ts`. A school marking differently cannot use Records at all. |
| Printable report-card layout | M | agreed | Deferred by the product owner to a future iteration. |
| Parent self-registration (QR, link, approval) | L | idea | Needs redesign: temporary registration shipped and overlaps the original idea. |
| Richer student profile, weeks-owed trends | M | idea | |
| Offline payment queue with reserved receipt blocks | L | idea | Designed in section 8 of the reliability spec. Deliberately deferred: new failure modes on money during a pilot whose purpose is proving the records can be trusted. |
| Rasterised PWA icons (192, 512) | S | idea | Icons are SVG today; PNG widens install support. |
| PR-gated docs check with branch protection | S | idea | Blocked, not chosen: branch protection is unavailable on private repositories on the GitHub Free plan. Would move `docs-freshness` from `push: main` to `pull_request`, making a stale PRD unmergeable rather than merely reported after the fact. Revisit if the repo goes public, the plan changes, or a second contributor joins. |

## Rejected, and why

| Item | Reason |
| --- | --- |
| Online payment collection | Bursar records money received and does not process transfers, by design. It keeps us out of the payments regulatory perimeter and out of the school's cash flow. |
| Multi-branch consolidation | Out of scope for a single-school tenant model. Revisit only if a school group becomes the buyer. |
| Supabase Pro, for now | 25 dollars a month is not defensible at zero revenue. The two things it buys, no-pause and daily backups, are had for nothing via the keep-alive and the nightly dump. Written upgrade triggers are in `docs/capacity-and-cost.md`. |
| Header progress bar for navigation | Fragile where mobile browser chrome moves. Route-level `loading.tsx` skeletons do the job with no custom component. |
| "Please do not tap again" copy on busy buttons | Treats the user as the problem. An idempotency key makes the second tap harmless, which is correctness rather than instruction. |
| A public parent-facing receipt link | A new security surface, and not needed to solve the problem that was actually reported. |
