# Prompt 01 — Inert schema: staff tables, staff_id columns, backfill, default-staff writes

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.B construction sites, §2.1 ERD, §3 migration plan). That report + this file are your only context. Backend Java root abbreviated `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

Introduce the staff data model as **inert** infrastructure: two Flyway migrations, three JPA entities + repositories, `staff_id` columns on `bookings` / `personal_appointments` / `booking_sales` / `closures`, backfill to Michela, and default-staff assignment on every write path — **no read path, no endpoint, no UI changes**. After this prompt the app behaves byte-identically; the only observable difference is that new rows carry `staff_id`.

## In scope
- `backend/src/main/resources/db/migration/VNN__create_staff_tables.sql` and `VNN+1__add_staff_id_columns_backfill.sql` (see Versioning below).
- New entities `StaffMember`, `StaffWorkingHours` (+ `staff_services` via `@ManyToMany` on `StaffMember`) and repositories, in a new `BE:staff/` package (mirror the `personalappointments/` package style).
- `Booking`, `PersonalAppointment`, `BookingSale`, `Closure` entities: add `@ManyToOne(fetch = LAZY)` `staffMember` (nullable).
- A small `DefaultStaffResolver` (`BE:staff/`): returns explicit staff if given, else the single ACTIVE staff, else the staff row linked to the ADMIN user. Used by the write sites below.
- Write sites that must set staff (all in `BE:services/BookingService.java` unless noted): Booking construction sites at lines ≈257, 324, 408, 656, 1069, 1235 (set default staff right after construction); `PersonalAppointmentService` create/update (`BE:personalappointments/`); `BookingSale` creation sites (`createOnlineProductSales` ≈2789, `buildAndPersistPromotionLink` ≈2873, and the drawer sale rows built inside create/update multi-service) — sale takes **its booking's** staff.

## Out of scope (do NOT touch)
Any availability/slot/finder logic, any controller or DTO, SecurityConfig, Role enum, Stripe/webhook logic beyond the two `new Booking(...)` sites listed (do not alter metadata, idempotency, refunds), reports, frontend, `working_hours` legacy table, `package_credits` (R7: stays staff-agnostic).

## Context budget (read only these)
1. `backend/src/main/resources/db/migration/` — `ls` for numbering; read `V73` + `V80` as the house style for guarded migrations.
2. `BE:entities/Booking.java`, `BE:entities/BookingSale.java`, `BE:entities/Closure.java`, `BE:personalappointments/PersonalAppointment.java`, `BE:entities/WorkingHours.java` (shape to copy), `BE:entities/User.java`.
3. `BE:services/BookingService.java` — ONLY the regions around the 6 construction sites and the 2 sale-creation methods (grep `new Booking(` and `new BookingSale`).
4. `BE:personalappointments/PersonalAppointmentService.java`.
5. One existing repository interface as style reference.

## Preconditions — STOP rules
- `git fetch` && current branch is up to date with `origin/main`; `V81__add_settled_at_to_bookings.sql` is the highest migration. If a version ≥82 exists, renumber and note it.
- **Versioning:** ask Davide to run `SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5` on production before finalizing VNN (expected: 81 → VNN=82). If prod differs from the repo, **STOP and report**.
- `grep -c "new Booking(" BE:services/BookingService.java` must return **6** (production sites; tests excluded). If not, STOP: the construction-site map is stale — re-derive before editing.
- If `Booking` already has any staff-like field, STOP (someone got here first).

## Ordered steps
1. **VNN migration:** create `staff_members` (id UUID PK, user_id UUID NULL UNIQUE REFERENCES users, display_name VARCHAR(80) NOT NULL, color VARCHAR(7) NULL, active BOOLEAN NOT NULL DEFAULT true, sort_order INT NOT NULL DEFAULT 0, created_at/updated_at), `staff_services` (staff_id FK CASCADE, service_id FK→`services` CASCADE, PK(staff_id, service_id)), `staff_working_hours` (id, staff_id FK CASCADE, day_of_week VARCHAR(16) NOT NULL, morning_start/morning_end/afternoon_start/afternoon_end TIME NULL, closed BOOLEAN NOT NULL DEFAULT false, UNIQUE(staff_id, day_of_week)). Then seed, guarded by a `DO $$ ... RAISE` block that **aborts unless exactly one row** in `users WHERE role='ADMIN'`: insert Michela's staff row (display_name from users.name), copy all 7 `working_hours` rows into her `staff_working_hours`, insert one `staff_services` row per row of `services`. Idempotent: skip inserts if `staff_members` non-empty.
2. **VNN+1 migration:** add nullable `staff_id UUID REFERENCES staff_members(id)` to `bookings`, `personal_appointments`, `booking_sales`, `closures`; backfill the first three to Michela's id (leave `closures.staff_id` NULL = salon-wide); create indexes `idx_bookings_staff_start (staff_id, start_time)`, `idx_personal_appts_staff_date (staff_id, appointment_date)`, `idx_booking_sales_staff (staff_id)`.
3. Entities + repos: `StaffMember` (with `@ManyToMany` services set, LAZY), `StaffWorkingHours`; add `staffMember` to the four entities (LAZY, `@JoinColumn(name="staff_id")`). Repository methods needed later, add now: `findByUserId_UserId`/equivalent, `countByActiveTrue()`, `findByActiveTrueOrderBySortOrder()`.
4. `DefaultStaffResolver` with the fallback chain above; log a WARN if it has to fall back past "single active".
5. Wire the resolver into the 6 Booking sites, PA create/update, and set `sale.staffMember = booking.getStaffMember()` at the 3 sale-creation groups.
6. Rollback notes as SQL comments at the top of each migration (drop tables / drop columns+indexes).

## Landmines (from CLAUDE.md + report)
- Flyway only; snake_case plural names; no direct DB edits. Do NOT auto-apply migrations — Davide applies manually local → prod (V80 precedent).
- `open-in-view=false`: keep the new associations LAZY and never dereference them outside a transaction (this prompt adds no reads, so just don't add `toString`/mapping that touches them).
- Do not add fields to any positional record DTO in this prompt.
- Webhook sites (1069, 1235): touch ONLY the line that sets the staff field. If the surrounding code doesn't match the report's description, STOP.

## Acceptance criteria
- App compiles; with migrations applied locally, boot passes `ddl-auto=validate`.
- New unit test(s): `DefaultStaffResolver` fallback chain; a service-level test asserting a created Booking/PA/sale carries a non-null staff (H2 test profile creates schema from entities — Flyway is off in tests, so seed a staff row in the test).
- Zero behavior change anywhere else (no endpoint output differs).

## Test gate
`cd backend && ./mvnw -q test-compile && ./mvnw -q test` → green (baseline 116 + new). `cd frontend && npm run build` → green (should be untouched).

## Expected diff size
~2 SQL files (+~120 lines), ~5 new Java files, ~10 small edits in existing entities/services. Total ≈ +450/−10.

**MERGE CHECKPOINT: yes** (I1 trivially holds — nothing reads staff yet).
**Recommended model/effort:** strongest available (Fable/Opus) @ xhigh — production migrations + money-file edits.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
