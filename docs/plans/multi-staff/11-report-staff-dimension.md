# Prompt 11 — Report: staff filter + per-staff breakdown (cash-basis engine untouched)

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.G two-ledger engine + what the reconciliation test asserts, §2.2 row 23, §5 decision 2). That report + this file are your only context. `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

Minimal v1 staff dimension on **Incassato**: an optional `staffId` query param on `GET /admin/report` and a per-staff breakdown block — **without touching the ledger semantics**. The no-param path must be byte-identical (that's what keeps `ReportRevenueReconciliationTest` green). Report stays owner-only (decision 2 — no STAFF access change).

## Attribution rules (v1 — implement exactly)
- **Trattamenti** rows → `bookings.staff_id` (join already available: rows originate from bookings).
- **Refund** rows → `bookings.staff_id` (negative to the same staff).
- **Prodotti in-store** rows (BookingSale) → `booking_sales.staff_id`.
- **Promozioni** rows → the linked booking's `staff_id`.
- **Pacchetti** (online `purchasedAt` + admin installments/upfront) and **online orders** → **"Non attribuito"** bucket in v1 (money is recognized at purchase/installment time, not tied to a performing staff — do NOT invent an attribution).
- Grand totals NEVER change: breakdown buckets (per staff + Non attribuito) must sum to the unfiltered total for each leg. When `staffId` param is present, filtered legs show that staff's rows; unattributed legs show 0 with an explicit note flag in the DTO.

## In scope
- `BE:repositories/ReportRepository.java`: the row queries for treatments/refunds/in-store products/promotions gain the staff column in their SELECT (additive — existing callers ignore it) or staff-filtered variants; pick the approach with the smallest diff, but do NOT fork the SQL semantics (same WHERE/EXCL fragments — copyless: parameterize `(:staffId IS NULL OR x.staff_id = :staffId)` where it keeps the plan sane; check EXPLAIN if you add it to the big native queries; indexes from prompt 01 exist).
- `BE:services/ReportService.java`: accept optional staffId; build the per-staff breakdown (group the already-fetched rows in Java — §1.G notes topClients already does in-service grouping; follow that pattern, no new heavy SQL).
- `BE:controllers/ReportController.java`: optional `staffId` param.
- Report DTOs: additive fields only (`perStaff: [{staffId, staffName, trattamenti, prodotti, promozioni, total}]`, `unattributed: {...}`, `staffFilterApplied: bool`). ⚠️ positional records: update every construction site + `test-compile`.
- FE (`FE:` report page — grep route `/admin/report`): staff dropdown (roster via `GET /admin/staff`) + breakdown card with "Non attribuito" row. Owner-only page already.

## Out of scope
Arretrati/Previsto staff filtering (v1: untouched). Commissions/percentages. Any settlement/booking write path. STAFF access to reports. Heatmap/topN per staff (untouched).

## Context budget
1. `BE:repositories/ReportRepository.java` (row queries §1.G: treatmentRows ≈155, refundRows ≈177, inStoreProductRows ≈269, promotionRows ≈398 — plus their SQL fragments TREAT_AMT/EXCL/COLL).
2. `BE:services/ReportService.java` (getReport ≈72–122, buildIncassato ≈153–196).
3. `backend/src/test/java/daviderocca/beautyroom/ReportRevenueReconciliationTest.java` — read it fully BEFORE coding; your change must not require touching it.
4. Report DTOs + FE report page + its api module.

## Preconditions — STOP rules
- Prompts 01–10 merged (staff columns populated). If `bookings.staff_id`/`booking_sales.staff_id` missing, STOP.
- **`ReportRevenueReconciliationTest` must pass unmodified before AND after.** If your design would require editing it, STOP — the design is wrong.
- If adding `:staffId` to a native query degrades its plan (no index use), fall back to Java-side grouping of the unfiltered rows (rows already carry staff after the SELECT addition) — prefer correctness + simplicity over SQL cleverness.

## Ordered steps
1. Read the reconciliation test. 2. Additive staff column on the four row queries. 3. Java-side grouping → breakdown DTO. 4. Optional filter param semantics. 5. New test: fixture with 2 staff → breakdown sums equal unfiltered totals per leg; packages/orders land in Non attribuito; filter returns only staff-X rows; no-param JSON identical to before (golden-ish assertion on the pre-existing fields). 6. FE dropdown + card.
   
## Landmines
- No emoji in native `@Query`. The 7-branch arretrati UNION is NOT in scope — don't touch it.
- Refunds are negative rows — they must subtract from the SAME staff bucket (test it).
- `open-in-view=false` — grouping inside `@Transactional(readOnly=true)`.
- FE: owner-only page; portals/Lenis rules if you add a dropdown overlay.

## Acceptance criteria
- No-param response: pre-existing fields byte-identical; reconciliation test green untouched.
- Breakdown invariant: Σ(per-staff + unattributed) = unfiltered totals, per leg and grand total.
- Filter behaves; FE renders breakdown + "Non attribuito".

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green — **call out `ReportRevenueReconciliationTest` explicitly in the summary**. `npm run build` green; eslint clean on changed files.

## Expected diff size
BE ≈ +250/−20 + tests; FE ≈ +150/−10.

**MERGE CHECKPOINT: yes** (param optional; owner-only surface).
**Recommended model/effort:** strong @ high — money-adjacent reporting invariants.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
