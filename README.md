# Bursar

**Every naira accounted for.**

A digital school administrator for Nigerian schools — student records, fees, and
every payment accounted for in one place. Built mobile-first as an installable
PWA for small and medium schools where staff work mostly from phones.

## Run it

```bash
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:3000. The app runs on realistic seeded demo data
("Tejuosho Group of Schools") with no backend required yet. Use the role chip in
the top bar to view Bursar as a **Proprietor**, **Bursar**, or **Teacher** and
see how access changes.

## What's built (MVP)

- **Dashboard** — outstanding total for the term, collected vs billed, fees
  status split, role-aware quick actions.
- **Outstanding balances (Owing)** — the core screen: every student owing,
  **sorted oldest first**, part-paid vs not-paid, searchable.
- **Record payment** — pick a student, part-payments supported, live "new
  balance" preview, auto-generated receipt number, confirmation screen.
- **Student records + bulk import** — profiles, guardian contacts, and a
  shareable-form → spreadsheet → upload flow (`.csv`/`.xlsx`) with per-row
  validation before anyone is added.
- **Reports** — fees collection by class.
- **Reminders** — SMS/WhatsApp fee reminders and payment confirmations, in
  Bursar's voice, behind a swappable provider.
- **Role-based access**, **installable PWA**, **offline-aware** (opens offline;
  blocks writing money with a calm message when there's no connection).

## Architecture

| Concern | Where |
|---|---|
| Design system / voice | `src/app/globals.css`, `src/components/ui.tsx` |
| Domain model & rules | `src/lib/domain/`, `src/lib/money.ts` (money is integer **kobo**, never float) |
| Data access (swappable) | `src/lib/data/repository.ts` → mock in `mock.ts`, seed in `seed.ts` |
| Messaging (swappable) | `src/lib/messaging/` (mock now, Termii adapter ready) |
| Database schema + roles | `supabase/schema.sql` (Postgres + Row-Level Security) |
| PWA | `public/manifest.webmanifest`, `public/sw.js` |

The UI talks only to the `Repository` interface, so connecting the real backend
means writing one Supabase-backed implementation — no screen changes.

## Connecting the backend (next steps)

1. **Supabase** — create a project, run `supabase/schema.sql`, then add a
   `supabaseRepository` implementing `Repository` and switch the export in
   `src/lib/data/repository.ts`. Money columns are `bigint` kobo; receipts are
   append-only by RLS policy.
2. **Termii** (SMS/WhatsApp) — add `TERMII_API_KEY` + a registered sender ID,
   expose an internal API route that uses `createTermiiProvider`
   (`src/lib/messaging/termii.ts`), and point `messaging` at it. Keys stay
   server-side.

## Known follow-ups

- Offline currently caches the app shell; caching **records** for offline
  reading (IndexedDB/Dexie) is the next task.
- PWA icons are SVG; add rasterized PNG (192/512) for the widest install support.
- Auth/sign-in screen (roles are demoed via the switcher for now).
- Online payments (Paystack/Flutterwave) — the ledger is architected to accept
  an `online` payment method later.
