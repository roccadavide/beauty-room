# Prompt 03 — Team backend API: staff CRUD, assignments, per-staff hours, absences, public list

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§2.1, §2.3, §3.5, §5 decisions 7/10). That report + this file are your only context. `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

Owner-facing REST API for managing the team, plus the public active-staff list. No frontend. API is inert until prompt 04's UI (and later flows) call it — I1 holds.

## In scope
- New `StaffController` (`/admin/staff`, class-level `@PreAuthorize("hasRole('ADMIN')")`) + `StaffService` + DTOs (Controller → Service → Repository; DTOs separate from entities; `ResponseEntity` wrappers; Bean Validation):
  - `GET /admin/staff` — all staff (active + inactive), with service-ids, sort order, color, linked-user email.
  - `POST /admin/staff` — body: displayName, email, password, phone, color. Creates in ONE transaction: `User` (role `STAFF`, `isVerified=true`, email/phone unique — reuse existing user-creation validation/encoding from `UserService`/`AuthService` register path) + `staff_members` row linked to it. 409 on duplicate email/phone.
  - `PUT /admin/staff/{id}` — displayName, color, sortOrder.
  - `PATCH /admin/staff/{id}/active` — deactivation guard (decision #10): if deactivating and future CONFIRMED bookings exist for this staff (`bookings WHERE staff_id=? AND booking_status='CONFIRMED' AND start_time >= now()`), return 409 with the blocking bookings (id, date, customer name) so the UI can list them. Reactivation always allowed. No hard-delete endpoint.
  - `GET/PUT /admin/staff/{id}/services` — replace-set semantics on `staff_services`.
  - `GET/PUT /admin/staff/{id}/working-hours` — the 7-day set, same shape as legacy `WorkingHours` (morning/afternoon ranges + closed), upsert per day.
- **Hours dual-write shim (§3.5):** from this prompt until the engine flips (prompt 06), the two editors must stay consistent: `WorkingHoursService` update/init (legacy `/working-hours` endpoints) ALSO mirrors into the **owner's** `staff_working_hours` rows; `PUT /admin/staff/{ownerStaffId}/working-hours` mirrors back into legacy `working_hours`. Mirror only for the owner's staff row (other staff have no legacy counterpart).
- **Absences (decision #7):** extend `Closure` create/update DTOs with optional `staffId` (entity column exists from prompt 01). `ClosureController` stays owner-only. Semantics: `staffId NULL` = salon-wide (today's behavior); non-NULL = that staff's absence. `GET /closures` response gains `staffId`. The `/closures/preview` conflict check: if `staffId` present, preview only that staff's bookings; else keep current behavior.
- **Public list:** `GET /api/public/staff?serviceId=` → active staff (id, displayName, color, sortOrder), filtered by qualification when `serviceId` given. Lives in `PublicController` (already `permitAll` under `/api/public/**` — verify in `SecConfig` lines ≈89; no SecConfig change needed if so).
- `PersonalAppointmentDTO` + request DTO gain `staffId` (additive; default = current user's staff via `CurrentStaffService`, else owner's). List endpoints accept optional `staffId` filter. Enforce matrix row 10: STAFF may only write their own PA (owner may write any) — guard in `PersonalAppointmentService`.

## Out of scope
All frontend (04). Availability engine (06). Booking write paths (08). Any Stripe/webhook file. Deleting/renaming legacy `working_hours` endpoints.

## Context budget
1. `BE:staff/` package from prompts 01–02 (entities, repos, `CurrentStaffService`).
2. `BE:controllers/WorkingHoursController.java` + its service (mirror target), `BE:controllers/ClosureController.java` + `Closure` entity + its DTOs.
3. `BE:controllers/PublicController.java` (style + placement), `BE:security/SecConfig.java` (verify `/api/public/**` rule only).
4. User-creation path: `AuthController.register` / `UserService` (reuse hashing + uniqueness validation).
5. `BE:personalappointments/` (controller/service/DTOs).
6. One admin controller as DTO/validation style reference (e.g. `CustomerController`).

## Preconditions — STOP rules
- Prompts 01–02 merged. If `staff_members` entity/repo or `CurrentStaffService` missing, STOP.
- If `PersonalAppointmentDTO` or Closure DTOs are positional records, update every construction site and run `test-compile` (grep first).
- If password hashing in the register path is not reusable as a bean/method, STOP and report rather than duplicating crypto config.

## Ordered steps
1. DTOs + `StaffService` + `StaffController` (CRUD, active-toggle with guard, services set, hours set).
2. Dual-write shim in `WorkingHoursService` + owner-mirror in `StaffService` hours update.
3. Closure `staffId` (DTOs, service mapping, preview filter).
4. Public staff list endpoint.
5. PA `staffId` (DTOs, default resolution, own-only guard for STAFF).
6. Tests: staff creation (user+staff atomicity, duplicate email 409), deactivation guard 409 with future booking fixture, services replace-set, hours upsert + dual-write mirror both directions, public list filtering by qualification, PA own-only guard.

## Landmines
- `open-in-view=false`: staff→services is LAZY — fetch with join or map inside `@Transactional(readOnly=true)`.
- No emoji in native `@Query` strings.
- The deactivation-guard query: index `idx_bookings_staff_start` from prompt 01 covers it — use it (WHERE staff_id + start_time).
- Endpoint naming kebab-case; keep `/admin/staff` (not `/staff-members`) per §5 naming.

## Acceptance criteria
- Full CRUD lifecycle exercisable via curl; public list returns Michela only (active=1) and respects `serviceId` filter.
- Dual-write proven by test: edit legacy hours → owner staff hours updated; edit owner staff hours → legacy updated.
- With no API consumer, app behavior unchanged (I1).

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green; `npm run build` green (FE untouched).

## Expected diff size
~10 new files (controller/service/DTOs/tests) + ~6 edited. Total ≈ +700/−20.

**MERGE CHECKPOINT: yes.**
**Recommended model/effort:** strong (Fable/Opus) @ high.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
