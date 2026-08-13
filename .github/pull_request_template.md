## What this changes

<!-- One or two sentences. What is different for a person using Bursar? -->

## Why

<!-- The reasoning, not the diff. What did you know that a reader will not?
     If this was a judgement call, say what you chose against. -->

## Done checklist

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test` green
- [ ] `npm run build` compiles
- [ ] **Docs updated in this branch**, per the table in `CLAUDE.md`. Features go
      in `docs/PRD-bursar-develop.md`. Tick the box below that applies.
  - [ ] The PRD was updated
  - [ ] No feature was added, removed or reshaped, so the PRD is still accurate
- [ ] Anything noticed but not fixed is in `docs/backlog.md`
- [ ] Security audit run before and after the build, if this touches data, auth
      or the database
- [ ] No em-dashes in any user-facing or documentation text
- [ ] Money handled as integer kobo, if this touches money

## Anything a reviewer should look at hardest

<!-- Point at the risky part. "The cache key includes userId and schoolId, and
     that is the line that stops cross-tenant leakage" is more useful than
     "please review". -->
