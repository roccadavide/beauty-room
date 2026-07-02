# Prompt 05 — Fix: PersonalAppointment blocks missing from finder & single-service slots

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§0.3, §1.C table). That report + this file are your only context. `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

Close the PersonalAppointment occupancy gap on **single-staff semantics**, before the per-staff refactor (prompt 06) freezes behavior with parity tests. This is an intentional behavior change: slots overlapping Michela's personal blocks stop being offered. Everything else is untouched.

## The gap (verified at `ee38cdd`)
PA blocks are honored by `getCombinedAvailabilities` (PA fetch at `AvailabilityService` line ≈178) and `getAvailableSlots` (≈457), but **NOT** by:
1. **Admin finder** `BookingService.findNextAvailableSlot(durationMin, after, allowedDays, windowStart, windowEnd)` (lines 1359–1465) — occupancy = bookings (`findByDateAndStatusNotCancelled`, line 1393) + closures only.
2. **Public single-service grid** `AvailabilityService.getServiceAvailabilities(serviceId, date)` (≈88–126) — bookings + closures only.
3. To verify and fix if affected: `findNextAvailableSlotForService` and `findNextAvailableCombinedSlot` (both in `AvailabilityService`, called from `PublicController:102/123`) — check whether their occupancy building includes PA; the combined one probably delegates to PA-aware code, the per-service one probably mirrors the gap.

## In scope
- Add PA intervals to the `booked`/blocked-interval construction of the surfaces above, using the same pattern as line ≈178: `personalAppointmentRepository.findByAppointmentDateOrderByStartTime(date)` → `[startTime, startTime + durationMinutes)`.
- In the admin finder specifically: PA intervals join the same `booked` list that bookings+closures feed (lines 1417–1433), so gap-scanning and **extend-past-hours window semantics (§0.2) remain untouched** — a PA inside an extended window blocks it like a booking would.
- Unit tests per surface: a PA overlapping the only candidate gap ⇒ slot moves past it / day reported full; PA outside working hours but inside an extended window ⇒ finder skips it.

## Out of scope
Any staff parameterization (06). `DayTimelineDTO` shape (FE already fetches PA separately — leave it; note in summary). Frontend. Any write path, Stripe, reports.

## Context budget
1. `BE:services/AvailabilityService.java` — the four methods + the PA-aware pattern at ≈178 and ≈457.
2. `BE:services/BookingService.java` lines 1359–1465 only.
3. `BE:personalappointments/PersonalAppointmentRepository.java` (existing query names).
4. Existing availability/finder tests if any (grep `findNextAvailableSlot` in `backend/src/test`).

## Preconditions — STOP rules
- Verify the gap still exists exactly as described: `grep -n "personalAppointment" BE:services/AvailabilityService.java` must show hits ONLY at the combined/available-slots methods, and zero hits in `BookingService.findNextAvailableSlot`. If the code has changed, STOP and re-derive.
- Do not "fix" by changing repositories' semantics — add PA to the callers' interval lists only.
- If the finder's structure differs from lines 1401–1462 as described (extend at 1408–1409, clamp at 1413–1414), STOP.

## Ordered steps
1. Finder: fetch the day's PAs once per day-iteration (outside the range loop, next to line 1393) and merge into `booked` alongside closures.
2. `getServiceAvailabilities`: merge PA intervals into its blocked list.
3. Verify/fix the two public next-slot methods.
4. Tests (new fixtures with a staff row not required — PA has no staff filter yet).

## Landmines
- `@Transactional(readOnly = true)` already on the finder — keep it; PA repo call happens inside it.
- The finder is called by both the admin endpoint and (indirectly) drawer flows — behavior change is *the point*; call it out plainly in the summary so Davide can mention it to Michela ("il prossimo disponibile ora rispetta i blocchi personali").
- Don't touch `maxAdvanceDays`, padding logic, or the day-pill/window plumbing.

## Acceptance criteria
- All four surfaces block on PA; combined behavior unchanged (already blocked).
- New tests demonstrate before/after for finder + single-service grid.
- No other endpoint output changes (closures/bookings-only fixtures produce identical results — assert at least one such regression case).

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green (baseline 116 + new). `npm run build` green (untouched).

## Expected diff size
~2 files edited + tests. Total ≈ +160/−5.

**MERGE CHECKPOINT: yes** (standalone, desirable fix; I1 unaffected — single-staff semantics).
**Recommended model/effort:** strong @ high — slot-engine correctness.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
