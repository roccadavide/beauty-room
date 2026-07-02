# Prompt 08 — Admin write paths: drawer staff picker, staffId on create/edit, qualification validation

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.D drawer, §1.B admin lifecycle, §2.2 rows 2/9/10, §2.3). That report + this file are your only context. `FE:` = `frontend/src/`, `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

Admin booking **writes** become staff-aware: the drawer gets a staff picker (hidden with 1 active staff), create/edit payloads carry `staffId`, the backend validates qualification + per-staff conflict, and a booking can be reassigned to another staff via edit. Personal appointments get their staff select. This is the last admin-side piece.

## In scope — backend
- `AdminBookingCreateDTO` + `NewBookingDTO`: add optional `staffId` (⚠️ if positional records: grep ALL construction sites — tests included — update each, `test-compile`).
- `createManualConfirmedBookingAsAdmin` (≈390), `createMultiServiceBooking` (≈504), `updateMultiServiceBooking` (≈1327): resolve staff = `dto.staffId()` → else `DefaultStaffResolver` (from prompt 01); call `assertStaffQualified(staff, services)` (from prompt 06; custom-service-only bookings skip qualification); ensure the SERIALIZABLE overlap check runs against THAT staff (prompt 06 made checks staff-scoped — pass the resolved staff in). On update: staff change re-runs conflict for the new staff; packages/credits/promos/sales reconcile logic untouched (sales keep inheriting `booking.staff` — prompt 01 rule — so reassignment updates their attribution with the booking; verify this happens on update).
- `createPayInStoreBooking` (≈294) accepts `NewBookingDTO.staffId` the same way (public flow sends it from prompt 09; absent ⇒ resolver). Validate: staff must be ACTIVE + qualified; if a customer-supplied staffId is invalid → 400 with a clear message.
- PA endpoints already accept `staffId` (03); verify write-guard (STAFF own-only, owner any) — no changes expected.

## In scope — frontend (`FE:features/admin/NewAppointmentDrawer.jsx`, ~3630 lines — targeted edits only)
- Staff picker: chip row (reuse the `.nad-chip` pattern — do NOT restyle `.is-active`) placed after the customer block, before service selection. Hidden when `useActiveStaff` gate is OFF (then payload omits `staffId`; backend resolver assigns Michela — today's behavior). Default when ON: first staff by `sortOrder`; EDIT pre-fills from `editBooking.staffId` (card DTO field from 07).
- Selected staff filters the service list to that staff's qualified services (roster from 07 includes service-ids via `GET /admin/staff`; if heavy, fetch qualification lazily). Changing staff: keep selected services that remain qualified, deselect the rest with a visible hint; reset the slot/next-available result (availability depends on staff).
- Drawer availability calls pass `staffId`: `getAvailableSlots`, next-available (`/admin/bookings/next-available`), and the day-pill/window block — params exist since 06.
- Personale tab (`PersonalForm` ≈3182+): staff select (owner: all staff; STAFF user: fixed to own, read-only), default = current user's staff (from `/users/me` staffId, prompt 02).
- Reassignment = open booking in EDIT, change staff chip, save (no drag between columns in v1 — tap-to-move stays within-staff time moves; note it).
- Draft snapshot: include `staffId` in the NEW-appointment draft capture/restore.

## Out of scope
Public modals/route flows (09). Stripe/webhook files (10). Agenda rendering (07, done). Reports/emails. Any change to settle/complete/delete flows beyond compilation.

## Context budget
1. Drawer: grep regions — customer block, service selection state (`selectedServices`), submit payload builders (CREATE ≈1588–1745 + EDIT), next-available block (≈1180–1456), `PersonalForm` (≈3182+), draft snapshot (≈3426–3475).
2. `BE:services/BookingService.java`: the 3 create/update methods' heads + where services get validated; `BE:staff/` helpers.
3. The two DTO files + `grep -rn "new AdminBookingCreateDTO\|new NewBookingDTO" backend/src` (all sites incl. tests).
4. Admin API module (`FE:` grep `next-available`, `available-slots`) + `useActiveStaff` (07) + `/users/me` shape (02).

## Preconditions — STOP rules
- Prompts 01–07 merged. Verify `assertStaffQualified` and staff-scoped conflict checks exist (grep). If missing, STOP.
- If drawer internals don't match the §1.D anchors (state names/regions), re-derive by grep before editing; if the submit payload builder can't be located confidently, STOP.
- Do not touch the package CASE A/B/C/D logic, installment editor, promo attach, or settle paths beyond passing staff through.

## Ordered steps
1. Backend DTO fields + resolver/validation wiring + update-reassignment conflict + tests (create with staff B while B busy ⇒ 400/409; create service X with staff not qualified ⇒ 400; update moving booking A→staff B revalidates and updates sales attribution).
2. FE picker + service filtering + slot-call params + reset semantics.
3. PersonalForm staff select + defaults.
4. Draft snapshot field.
5. Smoke on dev: gate OFF ⇒ drawer byte-identical (no chip row in DOM); gate ON ⇒ full flow create/edit/reassign with 2 fake staff.

## Landmines
- Positional records EVERYWHERE here — `test-compile` after every DTO change.
- SERIALIZABLE annotations untouched.
- `.nad-*` CSS is drawer-scoped but `.bm-*`/`.ud-*`/`.dtf--inline` are shared with public/admin (report §booking-CSS caution) — new styles under `.nad-staff-*` only.
- Drawer is portaled; keep it so. `data-lenis-prevent` if the chip row scrolls horizontally.
- No `console.log`; eslint clean on changed files.

## Acceptance criteria
- Gate OFF: DOM and payloads identical to today (`staffId` absent).
- Gate ON: staff selectable; services filtered; slots/next-available per staff; EDIT pre-fills; reassignment revalidates + moves sale attribution; PA staff select works per matrix row 10.
- Backend rejects unqualified/busy/inactive staff with clear 400/409.

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green (new validation tests included); `npm run build` green; eslint clean on changed files. Run `ReportRevenueReconciliationTest` explicitly (BookingService touched).

## Expected diff size
BE ≈ +200/−30 (3 methods + DTOs + tests); FE ≈ +350/−40 (drawer only).

**MERGE CHECKPOINT: yes** (gate OFF ⇒ identical; resolver keeps single-staff writes correct).
**Recommended model/effort:** strong @ high — SERIALIZABLE write paths + 3630-line file surgery.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
