# Prompt 06 — Availability engine: staff parameterization of every read surface + write-path conflicts

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.C table — the 9 surfaces, §2.1 core behavioral change, §3.5, §5 decision 6). That report + this file are your only context. `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

Occupancy, hours and conflict-checking become **per-staff**; "no staff specified" means **ANY = union of active qualified staff**. With exactly one active staff, every output is **byte-identical to prompt 05's behavior** — proven by characterization tests written BEFORE the refactor. Backend only; all API parameters additive and optional.

## Semantics (implement exactly)
- **Per-staff occupancy** = that staff's bookings (`bookings.staff_id`) + that staff's PAs (`personal_appointments.staff_id`) + global closures (`closures.staff_id IS NULL`) + that staff's closures/absences (`staff_id = X`). **Defensive rule:** a booking/PA with `staff_id IS NULL` blocks EVERY staff (should not exist post-backfill; log WARN if encountered).
- **Per-staff hours** = `staff_working_hours` rows for that staff (replaces reads of legacy `working_hours` in the engine). Include the one-shot resync + freeze note below.
- **ANY/union** (public no-choice, admin no-filter): a slot is available if available for ≥1 active staff **qualified for the requested service(s)** (qualification via `staff_services`; for combined/multi-duration requests with explicit services, qualified = staff assigned ALL requested services; where only a duration is known — e.g. `available-slots`, `day-status` — union over all active staff). Day is "Pieno" only if full for every qualified active staff.
- **Write-path conflict** = per-staff: `hasOverlapIncludingPadding`, `hasBlockingConflictExcluding` (line ≈1284) and every SERIALIZABLE create/update overlap check filter by the booking's staff. Two different staff may hold overlapping bookings.
- **Qualification validation helper** `assertStaffQualified(staff, services)` — used by write paths (prompts 08/10 will call it; wire it into the existing create paths NOW using each booking's staff, which is Michela=all-services, so no behavior change).
- **ANY-resolution helper** `resolveAnyStaff(services, start, end)` → free + qualified + active; tie-break least-loaded that day, then lowest `sort_order` (decision 6). Used by prompt 10; implement + test now.

## Surfaces to parameterize (report §1.C — all 9)
`getServiceAvailabilities`, `getCombinedAvailabilities`, `getAvailableSlots`, `getFullDays`, `findNextAvailableSlotForService`, `findNextAvailableCombinedSlot` (all `AvailabilityService`); `findNextAvailableSlot` (`BookingService:1359–1465` — **preserve extend-past-hours semantics §0.2 per staff**); `getDayTimeline` (open ranges become per-staff: add optional `staffId`; without it return the union frame — with 1 staff identical); the conflict checks above. Controllers (`AvailabilityController`, `PublicController`, `AdminBookingController`) gain optional `staffId` request params passed through.

## Out of scope
Any frontend. Booking-creation DTOs (08). Stripe/webhook (10). Reports. Team API. Removing legacy `working_hours` (freeze only).

## Context budget
1. `BE:services/AvailabilityService.java` (whole file — it is the subject).
2. `BE:services/BookingService.java`: finder 1359–1465, conflict checks (grep `hasOverlapIncludingPadding`, `hasBlockingConflictExcluding`), create/update overlap regions only.
3. `BE:repositories/BookingRepository.java` + `PersonalAppointmentRepository` + `ClosureRepository` (query inventory; add staff-filtered variants — keep the old signatures where the agenda still needs salon-wide lists).
4. `BE:staff/` (entities, repos, resolver from 01–03).
5. `BE:controllers/AvailabilityController.java`, `PublicController.java`, `AdminBookingController.java` (param pass-through only).
6. Existing tests for availability/finder + the prompt-05 tests.

## Preconditions — STOP rules
- Prompts 01–05 merged (PA-gap fix MUST be in — the parity gate depends on it). Verify: finder already blocks on PA. If not, STOP.
- **Characterization first:** before touching engine code, write tests capturing current outputs of all 6 availability surfaces + finder on representative fixtures (hours mon–sat, one closure, bookings with padding, one PA, extended window). These tests must pass BEFORE and AFTER the refactor. If you cannot make them pass before refactoring, STOP — the fixture understanding is wrong.
- One-shot resync: include migration `VNN__resync_owner_staff_hours.sql` (next free number; verify against repo + prod) that re-copies legacy `working_hours` → owner's `staff_working_hours` (idempotent upsert) — closes the staleness window if Michela edited hours between prompt 01's backfill and this deploy. The 03 dual-write keeps them in sync afterwards.
- If any surface's signature/algorithm no longer matches §1.C, STOP and report.

## Ordered steps
1. Characterization tests (green on untouched code).
2. Repo variants: staff-filtered day-bookings / PA / closures queries (indexed by `idx_bookings_staff_start`, `idx_personal_appts_staff_date`).
3. Internal engine core: a per-staff availability function (hours ∩ ¬occupancy) + a union combinator; rewire the 6 public/admin read surfaces + finder onto it (`staffId==null` ⇒ union over active qualified staff).
4. Write-path conflict checks → staff-scoped; wire `assertStaffQualified` into create/update using the booking's current staff.
5. Controllers: optional `staffId` params.
6. Multi-staff tests: 2 active staff, overlapping bookings on different staff both allowed; finder per staff vs union; qualification filtering (staff B lacks service X ⇒ union for X = staff A only); "Pieno" only when all qualified staff full; PA of staff A doesn't block staff B; global closure blocks both; NULL-staff booking blocks both; `resolveAnyStaff` tie-breaks.
7. Resync migration.

## Landmines
- SERIALIZABLE isolation on every existing write path must remain exactly as-is (do not touch annotations).
- No emoji in native `@Query`. New JPQL/native queries need matching indexes (01 created them).
- `open-in-view=false`: staff→services LAZY — qualification checks inside transactions.
- Positional records: `NextAvailableSlotDTO` and `PublicNextSlotDTO` shapes stay unchanged (no new fields needed here).
- Perf: never loop per-staff-per-day issuing queries — fetch the day's bookings/PAs for all staff once, group in memory (the agenda-day query already returns everything).

## Acceptance criteria
- Characterization tests green (single-staff parity), multi-staff tests green.
- `staffId` param absent ⇒ union; with 1 active staff, union ≡ that staff ≡ old behavior.
- Legacy `working_hours` no longer read by the engine (grep proves it: engine files reference `staffWorkingHours` only); dual-write from 03 still keeps tables consistent.

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green (baseline + characterization + multi-staff). `npm run build` green (untouched). Explicitly run `ReportRevenueReconciliationTest` (must be untouched-green — settlement is nearby in BookingService).

## Expected diff size
The largest backend prompt: ~8 files edited, +~600 lines of tests. Total ≈ +900/−200.

**MERGE CHECKPOINT: yes** (params optional; 1 active staff ⇒ identical outputs — the characterization suite is the proof).
**Recommended model/effort:** strongest available @ **max** — slot-engine correctness is risk #2.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
