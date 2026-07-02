# Multi-Staff Epic — Execution Guide

## Branch & worktree strategy

- One dedicated worktree for the whole epic: `.claude/worktrees/multi-staff` on branch `feat/multi-staff` cut from `origin/main`.
- **First action of EVERY session, no exceptions:** `git fetch && git status && git log --oneline -3 origin/main..HEAD` — the worktree must be current with `origin/main` (rebase/merge main in before starting; a stale worktree has burned us before).
- One prompt = one or more atomic conventional commits on `feat/multi-staff` (e.g. `feat(staff): inert schema + backfill (V82-V83)`). At every MERGE CHECKPOINT: `--no-ff` merge to `main` after the smoke checklist passes → deploy → **Davide applies any new migrations manually local → prod (V80 precedent) BEFORE deploying the backend** (`ddl-auto=validate` will refuse to boot otherwise).
- Every prompt in this epic is a merge checkpoint (I1 holds throughout because the whole epic ships "gate OFF": exactly one ACTIVE staff until the end). **The launch switch is not a deploy — it is Michela activating the second staff member, allowed only after prompt 13.**
- Rollback unit = revert the checkpoint's merge commit; migration rollbacks are noted inside each SQL file (columns/tables drop cleanly while nullable; the NOT NULL of prompt 13 reverts with `DROP NOT NULL`).

## Session schedule

| # | Prompt file | Model / effort | New chat | Attachments | Merge CP | iPad smoke (ngrok) | Rollback note |
|---|---|---|---|---|---|---|---|
| 01 | 01-schema-staff-entities-backfill | strongest / xhigh | yes | 00 + 01 | yes | none (inert) | revert merge; drop V82/V83 objects |
| 02 | 02-rbac-staff-role | strongest / xhigh | yes | 00 + 02 | yes | admin login + agenda + settle still OK | revert merge (annotations only) |
| 03 | 03-team-backend-api | strong / high | yes | 00 + 03 | yes | Impostazioni hours edit still applies (dual-write) | revert merge |
| 04 | 04-team-owner-ui | standard / medium-high | yes | 00 + 04 | yes | S1 + S2 | revert merge (FE only) |
| 05 | 05-personal-appointment-gap-fix | strong / high | yes | 00 + 05 | yes | S3 | revert merge (intentional behavior change goes away) |
| 06 | 06-availability-engine-per-staff | strongest / **max** | yes | 00 + 06 | yes | S4 (full booking parity pass) | revert merge; resync migration is idempotent/harmless |
| 07 | 07-agenda-multi-staff-ui | strong / high | yes | 00 + 07 | yes | S5 | revert merge |
| 08 | 08-admin-drawer-staff-writes | strong / high | yes | 00 + 08 | yes | S6 | revert merge |
| 09 | 09-public-booking-staff-step | standard / high | yes | 00 + 09 | yes | S7 | revert merge (FE only) |
| 10 | 10-money-path-staff-propagation | strongest / **max** | **yes — mandatory fresh** | 00 + 10 | yes | S8 (Stripe test mode) | revert merge; in-flight sessions safe via absent-metadata fallback |
| 11 | 11-report-staff-dimension | strong / high | yes | 00 + 11 | yes | S9 | revert merge |
| 12 | 12-emails-staff-name | standard / medium | yes | 00 + 12 | yes | none (email log check) | revert merge |
| 13 | 13-hardening-not-null-i1-sweep | strong / high | yes | 00 + 13 + 99 | yes — **final** | full I1 checklist (in prompt 13) | `DROP NOT NULL` migration |

## iPad smoke checklists (Safari on iPad via ngrok against local dev; test-staff = fake collaborator created via Team UI, DEACTIVATED again at the end of each smoke)

- **S1 (Team UI):** create staff (name/email/password/phone/color) → assign 2 services → set hours → create absence → deactivate (with a future booking: expect the 409 list) → reactivate.
- **S2 (STAFF login):** login as test-staff → NavBar shows Agenda+Notifiche only → direct URL to /admin/team & /admin/report redirects → agenda create/edit/settle a booking works → logout.
- **S3 (PA gap):** create a personal block over the only free gap → finder + public single-service calendar skip it; delete block → slot reappears.
- **S4 (engine parity):** with ONLY Michela active: public prenota + cart + package flows, admin finder with pills/window/out-of-hours badge — all identical to pre-epic behavior (compare against production).
- **S5 (agenda):** activate test-staff → day columns + chips focus + week stripes; landscape & portrait; horizontal scroll if you add 3+ fake staff; deactivate → single-column pixel-parity.
- **S6 (drawer writes):** activate test-staff → create booking on staff B; service list filters by qualification; overlapping bookings on A and B both allowed; reassign A→B via edit; PA with staff select; deactivate.
- **S7 (public step):** activate test-staff (qualified for the test service) → "Con chi vuoi prenotare?" appears; choosing B changes "Pieno" days + slots; "Prima disponibile" default; pay-in-store lands on chosen staff; deactivate → step gone, flows identical.
- **S8 (money, Stripe test mode):** activate test-staff → pay-online single service with staff B → webhook → booking on B in agenda; multi/cart with "Prima disponibile" → booking lands on a deterministic staff; package purchase → session-1 on chosen staff, credit usable later with staff A (R7); deactivate.
- **S9 (report):** date range covering S8 bookings → breakdown per staff + Non attribuito; no-filter totals match pre-epic shape.

## Context-reset triggers (fresh chat mandatory)

1. Default: **every prompt is its own fresh session** with exactly the listed attachments.
2. Additionally reset mid-prompt if: the session hit auto-compaction; the session deviated from its prompt or tripped ANY safety-valve STOP; you are about to start prompt 10 (money) — never run it in a reused or compacted session, even if the previous session "feels fine".
3. After a STOP: fix the plan documents first (update 00/NN to match reality), THEN start a fresh session on the corrected prompt. Never let a session improvise past its own STOP rule.

## Model routing

- **strongest + max/xhigh** (01, 02, 06, 10): production migrations, security sweep, slot-engine correctness, Stripe/webhook — the four places where a subtle error costs real money or real double-bookings.
- **strong + high** (03, 05, 07, 08, 11, 13): multi-file backend/FE work with invariants but well-fenced blast radius.
- **standard + medium/high** (04, 09, 12): mechanical UI wiring / template work over already-defined APIs.
- Final call per session is the operator's; when a "standard" session starts hitting STOP rules or ambiguity, restart it on the stronger tier rather than pushing through.

## Standing rules (apply to every session)

- Backend gate: `./mvnw -q test-compile && ./mvnw -q test` (baseline 116 green at `ee38cdd`; count only grows). Call out `ReportRevenueReconciliationTest` whenever BookingService/Report files are in the diff. Frontend gate: `npm run build` + eslint clean on changed files (3 repo-wide pre-existing eslint errors are known and not yours).
- Migrations: never auto-applied; Davide applies local → prod. Version numbers re-verified against prod `flyway_schema_history` at 01, 06, 13.
- New FE files mid-session: Davide clears `node_modules/.vite`.
- No new npm/Maven dependencies without explicit approval; no `console.log`; conventional commits; never push to `main` directly; never `--force`.
