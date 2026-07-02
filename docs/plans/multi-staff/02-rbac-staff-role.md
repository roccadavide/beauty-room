# Prompt 02 — RBAC: STAFF role, authorization sweep, current-staff resolution

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§0.4 evidence, §1.A, §2.2 permission matrix). That report + this file are your only context. `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

Introduce the `STAFF` role and make every backend authorization point match the §2.2 permission matrix. Owner keeps role `ADMIN` (decision §0.4 — do NOT rename). No staff CRUD, no UI, no new endpoints. After this prompt a STAFF user *could* operate daily flows if one existed — but none exists yet, so nothing observable changes (I1).

## In scope
- `BE:enums/Role.java`: `CUSTOMER, ADMIN, STAFF`.
- `@PreAuthorize` sweep per matrix — shared capabilities become `hasAnyRole('ADMIN','STAFF')`; owner-only stay `hasRole('ADMIN')`:
  - **→ `hasAnyRole('ADMIN','STAFF')`** (matrix rows 1–4, 7–9, 11–13, 18, 24, 25, 30): class-level on `AdminBookingController`, `AdminAgendaDayController`, `CustomerController`, `PersonalAppointmentController`, `BookingSaleController`, `AdminNotificationController`, `PostItController`; method-level admin endpoints of `BookingController` (consent, pmu-unsigned, no-show) and `OrderController` (list/detail/status/pay-in-store — **NOT refund endpoints**); `AdminPackageController` methods that serve the drawer's daily flows (assignment create/list — recurring-template CRUD stays ADMIN).
  - **stay `hasRole('ADMIN')`**: `DELETE /admin/bookings/{id}`, `POST /admin/bookings/{id}/refund`, order-refund endpoints, `WorkingHoursController`, `ClosureController`, `AppSettingsController`, `ReportController`, `ProductController`/`ServiceItemController`/`CategoryController`/`PromotionController`/`ResultController` writes, `UserController` admin methods (list, email lookup, verify, make/remove-admin, delete-other), `WishlistController` admin method.
- Service-layer guards (the 11 sites in §0.4): add `isStaffOrAdmin(User)` next to the existing `isAdmin(User)` in `BookingService` (def ≈3734) and `OrderService` (def ≈645); swap call sites per matrix: BookingService 391, 506, 1731, 1816, 2296, 2419, 2979 → `isStaffOrAdmin`; **1470 (hardDelete) stays `isAdmin`**; OrderService 108, 328 → `isStaffOrAdmin`; 241 → check what it guards: refund/destructive stays `isAdmin`, otherwise `isStaffOrAdmin`. Update the Italian error messages accordingly.
- Controller authority checks (`ProductController:38`, `ServiceItemController:37/54`, `PromotionController:67` — "include inactive for admin"): leave as `ROLE_ADMIN` (catalog visibility is owner concern).
- `CurrentStaffService` (`BE:staff/`): `resolveFor(User) → Optional<StaffMember>` via `staff_members.user_id`; expose `staffId` (+ display name) as additive fields on the `/users/me` response DTO.
- `AuthController.register`: verify it hard-codes `Role.CUSTOMER`; if a client-supplied role could ever reach the entity, close it.

## Out of scope
Staff CRUD endpoints (prompt 03), all frontend (STAFF login UX arrives with prompt 04), JWT claims (none needed — §1.A: role is not in the token), refresh-token logic, any availability/booking logic.

## Context budget
1. `BE:security/SecConfig.java` (route rules 81–146 — confirm none must change; they gate by *authenticated*, not role, except catalog writes which have method annotations too).
2. The controllers listed above (annotation lines only — grep `@PreAuthorize`).
3. `BE:services/BookingService.java` + `OrderService.java` — only the 11 guard lines + 2 definitions.
4. `/users/me` handler + its response DTO (`UserController:52` and the DTO it returns).
5. `BE:staff/` package from prompt 01.

## Preconditions — STOP rules
- Prompt 01 is merged (staff tables + `StaffMember` entity exist). If not, STOP.
- `grep -rn "isAdmin(" BE:services/` must yield exactly the 11 call sites + 2 definitions from §0.4. If the count differs, re-derive the inventory and include the delta in your report — do not skip unknown sites.
- `grep -rn "hasRole('ADMIN')" backend/src/main/java | wc -l` — record the number before/after; every removed occurrence must be accounted for in your final summary.
- If any endpoint's purpose is ambiguous w.r.t. the matrix, default to **owner-only** and flag it in the summary (fail closed).

## Ordered steps
1. Extend `Role`; confirm register path is CUSTOMER-only.
2. Sweep annotations per the two lists (do controllers one by one; keep a checklist in your summary).
3. Add `isStaffOrAdmin` helpers + swap the service-guard call sites per matrix.
4. `CurrentStaffService` + `/users/me` additive fields.
5. Tests: unit tests for the guard helpers; if MockMvc/security test infra exists, add representative endpoint tests (STAFF → agenda GET 200-path, settle allowed, refund 403, product POST 403, report 403); if no such infra exists, cover via service-level tests with a STAFF-role `User` fixture and note it.

## Landmines
- `@PreAuthorize` uses `hasRole` (ROLE_ prefix implied) — keep the same convention; do not mix `hasAuthority('ROLE_…')`.
- `open-in-view=false`: `CurrentStaffService` reads must be inside `@Transactional(readOnly = true)` or return scalars.
- Do not touch `JWTTools`/`JWTFilter` — no role claim exists and none is needed.
- The `/users/me` DTO may be a positional record — if so, update every construction site and run `test-compile`.

## Acceptance criteria
- Matrix rows 1–30 each map to a concrete annotation/guard decision recorded in your summary table.
- A STAFF-role user (test fixture) passes daily-ops guards and is rejected by owner-only guards.
- ADMIN behavior unchanged everywhere (existing tests untouched and green).

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green; `npm run build` green (FE untouched).

## Expected diff size
~15 files, mostly one-line annotation edits; +~120 lines of tests/helpers. Total ≈ +250/−40.

**MERGE CHECKPOINT: yes** (no STAFF users exist; ADMIN paths unchanged).
**Recommended model/effort:** strongest available @ xhigh — security sweep, fail-closed judgment calls.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
