# Prompt 13 — Hardening: NOT NULL enforcement + final I1 sweep (epic close-out)

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§3.4, §2.1 legacy-NULL rule, I1 definition in the epic brief quoted in §4 risk 4). That report + this file are your only context.

## Objective (one concern)

Close the epic: enforce `NOT NULL` on `bookings.staff_id` and `personal_appointments.staff_id` (every writer has set them since prompt 01), run the full I1 regression sweep, and leave a short state-of-the-world note for future work.

## In scope
- **Migration `VNN__staff_id_not_null.sql`** (next free version — verify repo AND prod `flyway_schema_history`): inside the migration, a `DO $$ ... RAISE` guard that aborts if `SELECT count(*) FROM bookings WHERE staff_id IS NULL` > 0 (same for `personal_appointments`) — the migration must be un-appliable rather than silently wrong; then `ALTER TABLE ... ALTER COLUMN staff_id SET NOT NULL` on both. Rollback note: `DROP NOT NULL`. **`booking_sales.staff_id` and `closures.staff_id` stay nullable by design** (NULL = unattributed / salon-wide).
- Entity annotations: `optional = false` / `nullable = false` on the two hardened associations.
- **Writer sweep (grep-verified, listed in your summary):** every `new Booking(` (6 sites), PA create/update, `new BookingSale` sites — each followed by a staff assignment on all paths (including tombstone + webhook). If ANY site can leave staff null, fix it HERE before the migration ships.
- **I1 regression checklist — execute and report each line (dev env, migrations applied, exactly 1 active staff):**
  1. Public: home → service → Prenota: no staff step; calendar/slots/"Pieno"/waitlist identical; pay-in-store + Stripe test checkout land bookings on Michela.
  2. Cart multi-service + mixed products: no staff step; checkout OK.
  3. Package purchase (sessions>1): notice + first-session booking OK; credit created staff-agnostic.
  4. Admin: agenda day/week single-column pixel-parity; drawer without staff chips; finder + day pills + Dalle/Alle + out-of-hours badge; create/edit/move/settle/complete/un-complete(today-only); PA create; product sale row; installments; arretrati badge.
  5. STAFF login (create a staff, then deactivate after the test): reduced nav, agenda ops allowed, owner-only endpoints 403; **deactivating the test staff restores single-staff UX everywhere** (gate flips OFF cleanly).
  6. Report: no-param output unchanged; breakdown shows Michela + Non attribuito.
  7. Emails (Mailgun sandbox/log): confirmation without staff line (1 active staff).
- Close-out note `docs/plans/multi-staff/DONE.md`: date, migration versions actually used, deviations from prompts, deferred items (v2 candidates: waitlist per staff, per-staff report arretrati, timeline per-staff open-ranges polish, legacy `working_hours` removal, drawer drag-across-columns).

## Out of scope
Any new feature. Any refactor. Anything the checklist reveals that needs more than a ~20-line fix → report it as a follow-up instead of fixing inline (except writer-sweep gaps, which are THIS prompt's job).

## Context budget
1. `backend/src/main/resources/db/migration/` (numbering + V73/V80 guard style).
2. Grep outputs: `new Booking(`, `new BookingSale`, PA service writes — read only the surrounding 10 lines each.
3. `docs/plans/multi-staff/99-execution-guide.md` (the checklist's canonical home — keep them in sync).

## Preconditions — STOP rules
- ALL prompts 01–12 merged and deployed at least to the dev DB; Davide confirms prod migrations applied through prompt 06's resync. If any prompt is missing, STOP.
- Prod NULL counts must be zero BEFORE writing the migration (Davide runs the two counts on prod). Non-zero ⇒ STOP and report which flow leaked.

## Ordered steps
1. Writer sweep → fix leaks (if any) → tests.
2. Migration + entity annotations.
3. Full checklist run (record pass/fail per line).
4. `DONE.md`.

## Landmines
- H2 test profile creates schema from entities: `nullable=false` will make tests fail loudly if any fixture forgets staff — fix fixtures, don't relax the constraint.
- Do not bundle unrelated cleanups into this diff.

## Acceptance criteria
- Migration guarded + applied locally; boot `validate` green; checklist 100% pass (or failures reported, unfixed by design).
- Writer-sweep table in summary: site → who sets staff.

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green; `npm run build` green; `ReportRevenueReconciliationTest` called out.

## Expected diff size
1 SQL + ~6 small Java edits + fixtures. ≈ +120/−20.

**MERGE CHECKPOINT: yes — final.** After this merges and migrations are applied, Michela may activate the second staff member (the epic's real "launch" switch).
**Recommended model/effort:** strong @ high (it's a verification prompt; judgment > volume).
**NEW CHAT: yes** — attach `00-audit-report.md` + this file (+ `99-execution-guide.md` for the checklist).
