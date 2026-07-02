# Prompt 09 — Public booking: "Con chi vuoi prenotare?" step + staff-aware public availability

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.C surfaces 1–6, §1.D→2.4 public flows, §5 decision 5). That report + this file are your only context. `FE:` = `frontend/src/`.

## Objective (one concern)

The public booking flows gain a staff-choice step **before date selection** — "Prima disponibile" (default) or a specific active qualified staff — and every public availability call becomes staff-aware. Pay-in-store carries the choice end-to-end (backend accepts it since prompt 08). **Stripe metadata is prompt 10** — this prompt only puts `staffId` into the checkout-session request bodies, where the backend ignores it until 10 (Spring's default Jackson config ignores unknown JSON fields — verify once with a quick request; if the DTOs are strict, drop the field from requests and leave a TODO for 10). Gate: the step renders only when ≥2 **active staff qualified for the selection**; otherwise everything is byte-identical (I1).

## In scope

- **Roster:** public hook `FE:hooks/usePublicStaff.js` → `GET /api/public/staff?serviceId=` (prompt 03), returning active qualified staff; derives the gate. Single-service flows pass the service id; cart/multi flows: fetch per full service set (call once per distinct serviceId and intersect, or extend the endpoint — prefer intersecting client-side to avoid backend work).
- **Step component** (shared): chip list — "Prima disponibile" (preselected, decision 5) + one chip per staff (displayName + color dot). Inserted before the date step in:
  1. `FE:features/bookings/BookingModal.jsx` (BookingFlow — single service + package sessions>1 notice flow),
  2. `FE:features/bookings/MultiServiceBookingModal.jsx` (cart, incl. mixed products),
  3. the `/prenota` route shell if it hosts its own step sequence (grep `BookingRoutePage`/`BookingRouteShell` — they render the same BookingFlow; verify and reuse).
- **Staff-aware data calls** (all params exist since 06): `useFullDays`/day-status, combined-slots / per-service availabilities, available-slots, `useNextCombinedSlot` (`/api/public/slots/next-combined`) → pass `staffId` when a specific staff is chosen; omit for "Prima disponibile" (=union).
- **Reset semantics:** changing the staff selection resets date + slot + next-available result (same pattern as duration/option change — find the existing reset effect and extend it).
- **Pay-in-store:** payload gains `staffId` (concrete choice) or omits it ("Prima disponibile" ⇒ backend resolver — note: until prompt 10's ANY-resolution lands in the money path, pay-in-store with "Prima disponibile" resolves via `DefaultStaffResolver`; with 1 active staff that is correct; with ≥2 it would pick the fallback — acceptable only because the gate cannot be ON in production until the epic completes; state this in your summary).
- **Waitlist:** entries don't carry staff in v1 (they store day/service; the deep-link re-entry passes through the staff step normally). Verify the prefill path still works; note it.
- Checkout-session request bodies (`create-session[-guest]`, `create-session-multi`): include `staffId`/`"ANY"` field client-side for prompt 10 to consume (see caveat above).
- ANY mode ("Prima disponibile"): pass ALL selected `serviceIds` to full-days, combined/slot grids and next-combined (per the 06 amendment). Explicit staff chosen: pass `staffId` as before. The staff-choice list for multi-service = staff qualified for ALL selected services (intersect per-service results of `/api/public/staff?serviceId=`, or extend that endpoint additively — implementer's choice). If the qualified set for the selected combination is empty, show a friendly message ("questi servizi si prenotano separatamente") instead of an empty calendar.

## Out of scope

Stripe session metadata, webhook, hold-creation staff wiring (ALL prompt 10). Admin drawer (08). Backend changes of any kind (if a backend change seems required, STOP — something is off).

## Context budget

1. `FE:features/bookings/BookingModal.jsx` + `MultiServiceBookingModal.jsx` (step sequence, `effectiveDuration` memo, date/slot reset effects, submit payload builders, pay-in-store call).
2. `FE:hooks/useFullDays.js`, `FE:hooks/useNextCombinedSlot.js` (URL builders — add staffId param).
3. `FE:components/common/DateTimeField.jsx` props only (fullDates flow unchanged).
4. The bookings API module (grep `create-pay-in-store`, `createBookingCheckoutSession`).
5. `/prenota` route shell files (grep `BookingRoutePage`).
6. Public CSS caution: `.bm-*` and `.ud-*` are SHARED between drawer/route/admin (report §1.D) — new step styles under a new `.bm-staff-*` (or similar) namespace.

## Preconditions — STOP rules

- Prompts 03/06/08 merged (public roster endpoint + staff params + pay-in-store staffId). Verify `GET /api/public/staff` responds and slot endpoints accept `staffId`. If not, STOP.
- If the step machinery in BookingFlow is not a simple ordered sequence (e.g. derived states), re-derive before inserting; if insertion requires restructuring >1 flow's state machine, STOP and report.

## Ordered steps

1. `usePublicStaff` + gate.
2. Step component + insertion in the 3 flows + reset wiring.
3. staffId through the 5 data hooks/calls.
4. Pay-in-store + checkout request bodies.
5. Smoke on dev with 2 fake active staff: chips appear only when both qualify; choosing staff B changes "Pieno" days and slots; "Prima disponibile" = union; gate OFF (deactivate staff B) ⇒ flows byte-identical (no step in DOM).

## Landmines

- Portals/`svh`/Lenis rules as usual; step must work in both UnifiedDrawer and BookingRouteShell shells.
- Full-day semantics differ per flow (single-service: selectable "Pieno"+waitlist; cart: disabled) — keep both, now per chosen staff.
- Don't touch the package first-session notice logic; it composes with the step.
- No new npm deps; eslint clean on changed files.

## Acceptance criteria

- Gate OFF ⇒ zero DOM/behavioral diff in all 3 flows.
- Gate ON ⇒ step precedes date; calendar/slots/next-slot react to the choice; reset works; pay-in-store booking lands on the chosen staff (verify in agenda columns).
- Waitlist unaffected.

## Test gate

`npm run build` green; eslint clean on changed files; `./mvnw -q test` still green (backend untouched — if you had to touch it, you violated scope).

## Expected diff size

FE only: ~7 files, ≈ +450/−60.

**MERGE CHECKPOINT: yes** (gate OFF in production until Michela activates staff #2 — which must not happen before prompt 10 is live; recorded in 99-execution-guide).
**Recommended model/effort:** standard model @ high — multi-flow FE wiring with strict parity.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
