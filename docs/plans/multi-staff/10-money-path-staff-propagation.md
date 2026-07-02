# Prompt 10 — MONEY PATH: staff through Stripe checkout metadata → webhook → persisted booking

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.B — entry points A–F table, webhook description, §2.1 ANY resolution, §4 risk #1, R7). That report + this file are your only context. `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

> ⚠️ **This is the single money-path prompt of the epic.** One concern only: carry the customer's staff choice through checkout and webhook. If ANY precondition fails, STOP and report — do not improvise. Do not refactor anything you pass by.

## Objective (one concern)

Every Stripe entry point writes the staff choice into session metadata; the webhook persists it on the booking (resolving "ANY" to a concrete staff at SERIALIZABLE-create time); the hold path assigns staff at hold creation; the package-purchase branch assigns session-1's booking while **`PackageCredit` stays 100% staff-agnostic (R7)**. Missing metadata (in-flight sessions from before this deploy, or single-staff operation) falls back to `DefaultStaffResolver` — behavior identical to today.

## In scope (ONLY these files)
- `BE:controllers/BookingCheckoutController.java`:
  - **Entry A/B** (`createStripeSessionForBooking`, ≈108–221): the payload (`NewBookingDTO`, field added by 08/09) flows into `createHoldBooking` — pass `staffId` so the **hold row carries the resolved staff from creation** (ANY ⇒ resolve via `resolveAnyStaff` from prompt 06 at hold time — the hold occupies that staff's calendar during payment, which is what SERIALIZABLE protects). Add metadata `staffId=<uuid>` (the resolved one) on session AND PaymentIntent, next to the existing `bookingId/serviceId/sessionsTotal` keys.
  - **Entry C/D** (`create-session-multi` ≈228–409 + promo variant ≈417–474): request body field `staffId` (or `"ANY"`, default when absent) → metadata key `staffId` verbatim (do NOT resolve here — no hold exists; resolution happens in the webhook's SERIALIZABLE create). Metadata budget: one short key, no format change to `products`/`serviceIds`.
  - **Entry E** (product-only promo): NO staff (Order world, R9 v1) — verify you change nothing there.
- `BE:services/BookingService.java`:
  - `createHoldBooking` (≈233–290): accept the resolved staff (parameter or via DTO), set it on the booking before the SERIALIZABLE overlap check runs for that staff.
  - `createMultiServiceBookingFromWebhook` (≈1022–1210): new `staffIdMeta` input from the webhook; resolve: valid UUID + active + qualified ⇒ that staff; `"ANY"`/absent/invalid ⇒ `resolveAnyStaff(services, start, end)`, fallback `DefaultStaffResolver` (log WARN on fallback). Set staff BEFORE the overlap/conflict check so the SERIALIZABLE check is per-staff (06 semantics). Product sales inside keep inheriting `booking.staff` (01 rule — verify, don't rewrite).
  - `recordMultiServiceConflictTombstone` (≈1211–1249): unchanged (tombstone gets default staff from 01 — fine).
- `BE:controllers/StripeWebhookController.java`:
  - Single-service completed path: the hold already carries staff (set at creation) — **no staff logic needed**; verify `confirmPaidBookingFromWebhook` doesn't clear it.
  - MULTI path: read `staffId` from metadata, pass into `createMultiServiceBookingFromWebhook`.
  - Package branch (`sessionsTotal>1`, ≈264–330): booking (the hold) already has staff; `PackageCredit` creation (`addToActiveOrCreate`) takes NO staff — assert by reading the call: if any staff-ish parameter appears there, STOP.

## Explicitly UNTOUCHED (verify at the end with `git diff --stat`)
Idempotency gate (`processedEventRepo.existsById`, record-after-success, race catch), refund blocks (auto-refund + `refund:` idempotency key, `charge.refunded` handler, `markRefundSettled`), tombstone method body, expired/failed handlers, email enqueues, account linking, `OrderService`, all consume/restore sites of `PackageCredit` (R7 audit: grep `consumeSessionForBooking|restoreSessionForBooking|refundPackageCredit` — zero diffs in/around them).

## Context budget
1. `BE:controllers/BookingCheckoutController.java` (whole file — it is the subject).
2. `BE:controllers/StripeWebhookController.java` (whole file).
3. `BE:services/BookingService.java`: ONLY `createHoldBooking`, `createMultiServiceBookingFromWebhook`, `recordMultiServiceConflictTombstone`, and the conflict-check helpers' signatures (from 06).
4. `BE:staff/` resolvers (01/06). 5. Existing webhook/booking tests (grep `Webhook`, `createMultiServiceBookingFromWebhook` in tests).

## Preconditions — STOP rules
- Prompts 01–09 merged. `resolveAnyStaff` + `assertStaffQualified` + staff-scoped conflict checks exist (grep). If not, STOP.
- The §1.B metadata tables must match the code exactly (keys `bookingId, serviceId, sessionsTotal, promotionId` on A/B; `bookingType, serviceIds, …, products` on C/D). Any mismatch ⇒ STOP.
- The idempotency gate must match §1.B (existsById at ≈91, record ≈108, race-catch ≈110–112). Any mismatch ⇒ STOP.
- Webhook has NO `@Transactional` of its own and no self-invocation — keep it that way; new logic lives in the service methods.
- If `createHoldBooking`'s SERIALIZABLE structure differs from the report, STOP.

## Ordered steps
1. Hold path: staff resolution at session-creation + metadata key (A/B).
2. MULTI request field → metadata (C/D); promo variant included.
3. Webhook MULTI read → service resolution logic (valid/ANY/absent/invalid × active × qualified) → per-staff SERIALIZABLE conflict.
4. R7 verification sweep (grep + read, zero-diff assertion).
5. Tests: webhook-level unit/service tests for the resolution matrix (concrete staff kept; ANY resolved deterministically per decision 6; stale metadata → fallback + WARN; unqualified staff id → fallback, booking still created — a paid customer must NEVER be rejected because of a staff-resolution problem; conflict-for-that-staff → existing PAID_CONFLICT tombstone+refund path fires exactly as before, assert via existing test patterns).

## Landmines
- **A paid session must always end in a booking or the existing PAID_CONFLICT flow — never a new failure mode.** Post-payment (webhook): staff-resolution failures degrade to fallback, never throw. Pre-payment (hold, entry A/B) is the opposite: if ANY-resolution finds no free qualified staff, reject exactly like the existing slot-conflict path — the customer has not paid yet, and falling back to a busy or unqualified staff would create a wrong hold.
- In-flight sessions at deploy have no `staffId` metadata ⇒ absent-branch must be exercised by a test.
- Do not reorder metadata writes; do not touch `products` parsing; no emoji anywhere near queries; positional-record rule if any DTO grows (prefer a plain parameter over widening a record here).
- Deploy note for the guide: backend (this prompt) can deploy before OR after 09's FE — absent field and ignored field are both safe; but **both must be live before Michela activates a second staff**.

## Acceptance criteria
- All six §1.B rows behave: A/B hold carries staff + metadata; C/D metadata → persisted staff; E untouched; F already done (08/09).
- Resolution matrix covered by tests; refund/idempotency/tombstone diffs = zero (show `git diff --stat` in the summary).
- `PackageCredit` grep sweep documented: no staff anywhere in its lifecycle.

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green (baseline + new webhook tests). Run `ReportRevenueReconciliationTest` explicitly. `npm run build` green (FE untouched).

## Expected diff size
3 files, ≈ +180/−25, + ~200 lines of tests. Small on purpose.

**MERGE CHECKPOINT: yes** (fallbacks ⇒ identical single-staff behavior; in-flight sessions safe).
**Recommended model/effort:** strongest available @ **max**. Fresh chat mandatory; do not run this after a compacted/deviated session.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
