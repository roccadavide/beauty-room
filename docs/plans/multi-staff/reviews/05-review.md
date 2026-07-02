# Review — Prompt 05 — APPROVE WITH NOTES

| severity | file:line | issue | suggested fix |
|---|---|---|---|
| LOW | AvailabilityService.java:124 | PA merge in `getServiceAvailabilities` doesn't null-guard `startTime`/`durationMinutes`, while the finder site (BookingService.java:1417) does. Harmless — both fields are `nullable=false` (`start_time`, `duration_minutes int=60`), and this mirrors the pre-existing `getAvailableSlots` site (line 467). | Optional: align the two sites (either both guard or both don't) for consistency. No correctness impact. |

**Scope conformance.** Clean. `git status`: `AvailabilityService.java` + `BookingService.java` edited, `AvailabilityServiceTest.java` edited, `BookingServiceFinderTest.java` new — exactly the prompt's "In scope (~2 files + tests)". No frontend, write-path, Stripe, or DTO-shape files touched. `git diff --stat`: +58/−2, well inside the ~+160/−5 envelope.

**Preconditions / STOP rules.** Gap confirmed pre-fix (finder built occupancy from `findByDateAndStatusNotCancelled` + closures only). Finder structure matches the described shape: extend-past-hours at 1428–1429, clamp at 1433–1434 — no STOP triggered. Repositories' semantics untouched; PA added only to callers' interval lists.

**Step & acceptance walk.**
- Step 1 (finder): PA fetched once at line 1415 **outside** the range loop (1421), merged into `booked` at 1455–1460 with the identical overlap predicate used for bookings/closures. Extend/clamp window logic byte-identical. ✓
- Step 2 (`getServiceAvailabilities`): PA intervals appended to `blockedIntervals` (122–129). ✓
- Step 3 (public next-slot): `findNextAvailableSlotForService` delegates to `getServiceAvailabilities` (now PA-aware) → gap closed transitively; `findNextAvailableCombinedSlot` delegates to `getCombinedAvailabilities` (already PA-aware). Neither needed editing — correct call, verified by reading both methods (277–389). ✓
- Step 4 (tests): 6 finder + 1 single-service. ✓
- Acceptance "≥1 regression case with bookings/closures-only fixture identical": `finder_emptyDay_returnsFirstSlot`, `finder_booking0910_pushesTo10` (empty PA stub, unchanged outcome). ✓ Combined behavior unchanged (not touched). ✓

**Epic invariants.** I1: n/a — single-staff semantics, no `>=2`/activeCount logic in the diff. Additive-only: no signature/field/param changes. R7: `package_credits`/package machinery untouched. Transactions: `@Transactional(readOnly=true)` preserved on both the finder (1368/1373) and `getServiceAvailabilities` (88); PA repo calls happen inside those tx; no new `REQUIRES_NEW`/SERIALIZABLE. Money quarantine: no Stripe/webhook/refund files touched.

**Landmines.** No new `@Query` (repo query pre-existed) → no astral/emoji risk. No migrations in this prompt. PA read is inside the readOnly tx (no open-in-view leak). Mutable-list wrapping (`new ArrayList<>(...)`) is safe — `toEffectiveBlockedIntervals` result is only appended to locally.

**Test quality.** Non-tautological and mutation-sensitive: `finder_pa0910_pushesTo10_parityWithBooking` (drop the merge → asserts 09:00 instead of 10:00, fails), `finder_extendedWindow_paBlocksExtendedSlot` (drop the merge → returns 12:00 instead of null, fails), `singleService_personalAppointmentBlocks` (drop the merge → slot(1) flips available, fails). Parity design is real — the new single-service test mirrors the existing `singleService_outputUnchanged_withBooking` (line 100) swapping booking→PA, both asserting `["09:00","10:00","11:00"]`. `maxAdvanceDays` pinned to 1 via `ReflectionTestUtils` for deterministic day-0-only scan. Suite grew 166→173 (+7). No Report/settlement files touched → `ReportRevenueReconciliationTest` untouched and green.

**Security.** No `@PreAuthorize`/authority changes.

Gates: `./mvnw -q test-compile` clean. `./mvnw test` → **Tests run: 173, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS**. `npm run build` not run — no FE files in the diff (correct per prompt).

Rationale: The diff does exactly one thing — merge PersonalAppointment intervals into the two gapped occupancy surfaces (admin finder + single-service grid) using the established pattern, with the two public next-slot methods fixed transitively via delegation. Extend-past-hours window semantics, transactions, and additive-API invariants are all preserved; tests are meaningful and demonstrate before/after plus regression parity. The only note is a cosmetic null-guard asymmetry with zero runtime impact given the non-null schema. Approve; Davide still owns the commit (no SQL migration in this prompt to line-read).
