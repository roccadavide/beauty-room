# Multi-Staff ("Team") — Step-0 Audit Report & Master Plan

**Audited commit:** `ee38cdd` (`main` == `origin/main`, tree clean) · **Date:** 2026-07-02
**Test baseline:** `./mvnw -q test` → **116 tests, 0 failures, 0 errors, 0 skipped (19 classes) — GREEN**. `test-compile` clean.
**Latest Flyway migration on main:** `V81__add_settled_at_to_bookings.sql` → next free version **V82** (⚠️ re-verify against production `flyway_schema_history` before assigning — see §3).

All paths below are repo-relative. Backend Java root: `backend/src/main/java/daviderocca/beautyroom/` (abbreviated `BE:` below). Frontend root: `frontend/src/` (abbreviated `FE:`).

---

## 0. Corrections to the brief (pushback with evidence)

1. **"Email outbox enqueue uses REQUIRES_NEW" is wrong.** `BE:email/outbox/EmailOutboxService.java` uses plain `@Transactional` on all enqueue methods (lines 27, 42, 126, 144, 216) — the outbox row intentionally commits atomically with the domain change (that is the point of the transactional-outbox pattern). The `REQUIRES_NEW` landmine actually lives in `AdminNotificationService.create()` (notification failure must not roll back the booking). Implementation prompts must preserve _both_ patterns as they actually are.
2. **The admin finder's time-window EXTENDS past salon hours (V2 behavior is on main).** `BookingService.findNextAvailableSlot` lines 1408–1409: if `windowStart` is _before_ the first range's start it is **lowered** to `windowStart` (and symmetrically `windowEnd` raises the last range's end); lines 1413–1414 then clamp inside the window. The FE derives an amber "Fuori orario" badge from this. A first-pass reading as "clamp-only" is wrong — the staff-aware rework must preserve extend semantics.
3. **The PersonalAppointment gap is wider than stated.** Known gap confirmed: the admin finder ignores `PersonalAppointment` (only `findByDateAndStatusNotCancelled` + closures at lines 1393/1396). But additionally: the **public single-service endpoint** `getServiceAvailabilities` (`BE:services/AvailabilityService.java` ~88–126) does NOT block on PersonalAppointment either, while `getCombinedAvailabilities` (line 178) and `getAvailableSlots` (line 457) DO. And the admin `DayTimelineDTO` omits PA (FE fetches them separately). Prompt 05 fixes the whole family, not just the finder.
4. **R1 naming: renaming `ADMIN`→`OWNER` in code/DB is high-risk, low-value.** The role string `ADMIN` appears in: ~40+ `@PreAuthorize("hasRole('ADMIN')")` sites across 30 controllers, **11 service-layer guards** (`isAdmin(...)` in `BookingService` ×8: lines 391, 506, 1470, 1731, 1816, 2296, 2419, 2979; `OrderService` ×3: lines 108, 241, 328; definitions at `BookingService:3734`, `OrderService:645` matching authority string `"ROLE_ADMIN"`), 4 controller-level authority checks (`ProductController:38`, `ServiceItemController:37/54`, `PromotionController:67`), FE role checks in 11 files (`roles={["ADMIN"]}` / `user.role === "ADMIN"`), and `AdminInitializer`. **Recommendation: keep `ADMIN` as the owner's stored role/authority; add `STAFF`.** "OWNER" is a documentation/UI concept ("Titolare"); one missed string in a rename = owner locked out in production. (Open decision #1.)

---

## 1. Current-state map

### 1.A Security & identity

- **Roles:** `BE:enums/Role.java` → `CUSTOMER, ADMIN` only. Stored as `EnumType.STRING` on `users.role` (`BE:entities/User.java:55–56`). Authority = `"ROLE_" + role.name()` (`User.java:85`).
- **JWT (verified directly):** `BE:tools/JWTTools.java:23–33` — claims are `sub` (email), `id`, `jti`, `isVerified`, `iat`, `exp` (15 min). **No role claim.** Role is resolved per-request server-side: `BE:security/JWTFilter.java` loads the User by email and uses `getAuthorities()`. ⇒ **changing role semantics never invalidates live tokens**, and the FE learns the role only from `/users/me`.
- **Refresh:** `BE:entities/RefreshToken.java` — httpOnly rotating cookie (`refresh_token`, path configurable `/auth` / dev `/api/auth`), 14d or session per `rememberMe` column (V79), 30s grace window, reuse ⇒ revoke-all (`BE:services/RefreshTokenService.java:59–114`). **No role data in the refresh chain** — RBAC changes don't touch it.
- **Route rules:** `BE:security/SecConfig.java:81–146` (`@EnableMethodSecurity`, STATELESS). Public: `/api/public/**`, `/auth/**`, `/stripe/webhook`, guest checkout endpoints, GET catalog/availability/promotions/results, `/waitlist`. Everything else `authenticated()` + method-level `@PreAuthorize`.
- **Admin identity:** single seeded admin from properties (`BE:AdminInitializer.java:37–44`). `PATCH /users/{id}/make-admin|remove-admin` endpoints exist (unused by UI).
- **FE auth:** access token in memory (`FE:utils/token.js`), boot refresh in `FE:main.jsx:19–42` with single-flight dedup (`FE:api/httpClient.js:41–95`), guard `FE:components/common/PrivateRoute.jsx` checks token validity + `user.role` (from Redux, populated by `/users/me`). Admin links also gated in `FE:components/layout/NavBar.jsx` and 10 other files checking `"ADMIN"`.

### 1.B Booking domain & money paths

- **Entity:** `BE:entities/Booking.java` (~257 lines). Key fields: status enum (`PENDING_PAYMENT, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, REFUNDED`), customer snapshot (name/email/phone), `startTime/endTime`, `paidAt`, `completedAt`, `settledAt` (V81, stamped once by settle), `canceledAt/cancelReason`, `stripeSessionId`, `paymentMethod` (`PAID_ONLINE|PAY_IN_STORE`), `paddingMinutes`, `createdByAdmin`, custom service fields + `customServicePaid`, `customTotalPrice`, `currentSession/totalSessions`, `packageCredit` FK + `creditTrackedAtCreation` (V72: consume at booking time), `services` @ManyToMany via `booking_services`, `user`/`linkedUser` FKs. **No staff notion anywhere.**
- **Construction sites (6, excluding tests)** in `BE:services/BookingService.java`:
  | line | method | flow |
  |---|---|---|
  | 257 | `createHoldBooking` | public Stripe hold (single service, 12-min expiry) |
  | 324 | `createPayInStoreBooking` | public pay-in-store (verified users), CONFIRMED immediately |
  | 408 | `createManualConfirmedBookingAsAdmin` | admin single-service |
  | 656 | `createMultiServiceBooking` | admin multi-service (package CASE A/B/C/D) |
  | 1069 | `createMultiServiceBookingFromWebhook` | webhook MULTI (SERIALIZABLE) |
  | 1235 | `recordMultiServiceConflictTombstone` | webhook PAID_CONFLICT tombstone (own tx) |
- **Checkout entry points** (`BE:controllers/BookingCheckoutController.java`):
  - **A/B** `POST /checkout/bookings/create-session[-guest]` → hold at line 111, session metadata: `bookingId, serviceId, sessionsTotal, [promotionId]` (+ same on PaymentIntent).
  - **C** `POST /checkout/bookings/create-session-multi` → **no pre-hold**; metadata: `bookingType=MULTI, serviceIds, serviceOptionIds, date, startTime, totalDurationMinutes, customerName, customerPhone, notes, consentLaser/Pmu, [servicesTotalCents], [promotionId], [products=id:qty:cents,…]`.
  - **D** promo variant (line 417–474): `bookingType=MULTI, promotionId`, no serviceIds.
  - **E** product-only promo → `promoType=PRODUCT` → `OrderService.fulfillProductPromoOrder` (Order, **no booking**).
  - **F** `POST /checkout/bookings/create-pay-in-store` → `createPayInStoreBooking` (no Stripe).
- **Webhook** (`BE:controllers/StripeWebhookController.java`, 715 lines): events `checkout.session.completed|expired`, `payment_intent.payment_failed`, `charge.refunded`. Idempotency: `processedEventRepo.existsById(event.getId())` gate at line 91, record-after-success at 108, duplicate-insert race caught (110–112). Single-service path confirms the hold in place (`confirmPaidBookingFromWebhook`), handles PAID_CONFLICT auto-refund (idempotency key `refund:<paymentIntentId>`), creates `PackageCredit` when `sessionsTotal>1` (find-or-create Customer, `addToActiveOrCreate`, consume session-1). MULTI path calls `createMultiServiceBookingFromWebhook` (SERIALIZABLE, conflict ⇒ rollback + tombstone in fresh tx + auto refund). The controller itself has **no** `@Transactional` — each service call manages its own tx; no self-invocation landmine present.
- **Admin lifecycle** (`BE:controllers/AdminBookingController.java`, class-level `hasRole('ADMIN')`): `POST /admin/bookings/manual` · `POST /admin/bookings/create` (DTO `AdminBookingCreateDTO`) · `PUT /admin/bookings/{id}` (`updateMultiServiceBooking`, line 1327, SERIALIZABLE) · `PATCH …/status` (today-only un-complete guard) · `PATCH …/settle` (`settleBookingLines` line 2418: bundle/lockstep + per-line maps + `settledAt` stamped once + optional `alsoComplete`) · `DELETE …` (`hardDeleteBooking` line 1469, only PENDING_PAYMENT/CANCELLED, restores credit) · `POST …/refund` (`refundBooking` line 2706, Stripe refund, guard: paidOnline ∧ ¬CANCELLED/REFUNDED ∧ ≤60d).
- **Packages:** `PackageCredit` (table `package_credits`) is **customer-scoped** (customerEmail + nullable Customer FK + option FK + `purchasedAt` @PrePersist + `stripeSessionId`); consume/restore sites: webhook line 326, admin create 434/845, update/cancel restore paths, refund `markRefundSettled`/`refundPackageCredit`. In-person: `ClientPackageAssignment` + `BookingPackageLink` (per-session `paid`, `sessionTrackedAtCreation`) + `PackageInstallment` (dueDate/paidDate/paid). **No staff notion — R7 already holds structurally.**
- **Arretrati query:** `BE:repositories/ReportRepository.java:455–517` — 7-branch native UNION (booking_services unpaid / custom service / package links / legacy principal / customTotalPrice / standalone sales / promo links).

### 1.C Availability engine (all surfaces that must become staff-aware)

| #   | surface                                                                                                                                                                                                                         | where                          | blocks on PA?                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| 1   | `getServiceAvailabilities(serviceId, date)` — public single-service day grid (step=duration)                                                                                                                                    | `AvailabilityService` ~88–126  | **NO (gap)**                                        |
| 2   | `getCombinedAvailabilities(date, duration)` — public combined grid (10-min step)                                                                                                                                                | ~148–190 (PA at 178)           | yes                                                 |
| 3   | `getAvailableSlots(date, duration, excludeId)` — 30-min starts, public + admin drawer                                                                                                                                           | ~428–495 (PA at 457)           | yes                                                 |
| 4   | `getFullDays(from, to, duration)` — "Pieno" day-status (62-day guard)                                                                                                                                                           | ~217–250 (delegates to #2)     | yes                                                 |
| 5   | `findNextAvailableSlotForService` — public next slot per service (`/api/public/slots/next`)                                                                                                                                     | `PublicController:102`         | (verify in prompt 05)                               |
| 6   | `findNextAvailableCombinedSlot(duration, fromDate, fromTime, daysOfWeek, windowStart, windowEnd)` — public next combined (`/api/public/slots/next-combined`, used by BookingModal + cart via `FE:hooks/useNextCombinedSlot.js`) | `PublicController:123–141`     | (verify in prompt 05)                               |
| 7   | **Admin finder** `findNextAvailableSlot(durationMin, after, allowedDays, windowStart, windowEnd)` — `GET /admin/bookings/next-available`; extend-past-hours semantics (see §0.2)                                                | `BookingService:1359–1465`     | **NO (gap)**                                        |
| 8   | `getDayTimeline(date)` → `DayTimelineDTO {openRanges, closures, bookingRanges}` — admin timeline frame                                                                                                                          | `AvailabilityService` ~403–411 | not included (FE fetches PA separately)             |
| 9   | Write-path conflict checks: `hasOverlapIncludingPadding`, `hasBlockingConflictExcluding` (line 1284) + the SERIALIZABLE create/update paths                                                                                     | `BookingService`               | n/a — **salon-global today; must become per-staff** |

- **Hours model:** `working_hours` — one row per `DayOfWeek` (unique), `morningStart/End`, `afternoonStart/End`, `closed` (`BE:entities/WorkingHours.java`). Admin CRUD `BE:controllers/WorkingHoursController.java` (all ADMIN).
- **Closures:** `closures` — date range (`startDate/endDate`, legacy `date` kept in sync) + optional time window; helpers `isFullDay/isMultiDay/coversDate` (`BE:entities/Closure.java`). Admin CRUD + `/closures/preview` (`BE:controllers/ClosureController.java`).
- **PersonalAppointment:** `personal_appointments` — `appointmentDate`, `startTime`, `durationMinutes`, title/notes (`BE:personalappointments/PersonalAppointment.java`); CRUD `/admin/personal-appointments[…/week]`; created from the drawer's "Personale" tab (`PersonalForm`, `FE:features/admin/NewAppointmentDrawer.jsx` ~3182+); rendered as `ag-tl-personal` blocks. **No staff column.**

### 1.D Agenda UI & queries

- **Shell:** `FE:features/admin/AdminWorkspace.jsx` — lazy 3-view shell (`?view=agenda|clienti|postit`) at `/profilo/admin/agenda`, opacity-only fades.
- **Day timeline:** `FE:components/admin/AdminAgendaPage.jsx` (~1800 lines) — %-based positioning over a 24h column, tiered gridlines, booking blocks + closures + PA blocks + now-line; tap-to-select then action buttons (no dnd). Data: `getTimelineDay(date)` (`/availabilities/admin/timeline/day`), `getBookingsDay(date)` (`/admin/bookings/day`), `getPersonalAppointmentsDay(date)`, week via `/admin/bookings/range` (`to` exclusive) + `WeeklyCalendar.jsx`.
- **Card DTO:** `BE:DTO/bookingDTOs/AdminBookingCardDTO.java` — **positional record, ~47 components, exactly 1 construction site** (`BookingService.toAdminCard` ~line 3450). Adding a component ⇒ update that one site + run `test-compile`.
- **Drawer:** `FE:features/admin/NewAppointmentDrawer.jsx` (**3630 lines**) — customer autocomplete/inline-create; service multi-select + options + custom service; "Pacchetti attivi" cards; promotions; product sale rows; installment editor; next-available block (day pills + Dalle/Alle + presets + result); draft snapshot for NEW only; Personale tab; CREATE `POST /admin/bookings/create` / EDIT `PUT /admin/bookings/{id}`.

### 1.E Customers

`BE:entities/Customer.java` — separate from User (no FK), dedup key `phone_normalized` **E.164** (V80 on main; `BE:util/PhoneNormalizer.java` B1–B4 branches), partial unique index `ux_customer_phone`; `findOrCreate` is **phone-only** with race-retry (`BE:services/CustomerService.java:71–120`); email stored, never matched. `users.isVerified` gates pay-in-store; toggle `PATCH /users/{id}/verify` (ADMIN).

### 1.F Product sales

`BE:entities/BookingSale.java` (table `booking_sales`) — `bookingId` (plain UUID), `productId`, `productName` snapshot, `quantity`, `unitPrice`, `addedAt`, `promotionLinkId` (promo-bundled), `originalUnitPrice`, `paid`. **No attribution field.** Created by: admin drawer payload (rides booking create/update), `createOnlineProductSales` (webhook MULTI path, inside SERIALIZABLE, `paid=true`, native stock decrement), promo-link attach (`buildAndPersistPromotionLink` ~2873). Online shop `orders`/`order_items` are a separate world (unattributed in v1 per R9).

### 1.G Report engine

`BE:controllers/ReportController.java` (`GET /admin/report`, ADMIN) → `BE:services/ReportService.java` + `ReportRepository`. **Two ledgers:** _Incassato_ (cash collected, dated: online `paidAt`; in-store `COALESCE(settledAt, completedAt)`; products in-store `COALESCE(booking.settledAt, sale.addedAt)`; online packages `purchasedAt`; installments `paidDate`; promos conditional) and _Previsto_ (future CONFIRMED unpaid + arretrati). Legs are mutually exclusive via SQL `EXCL` fragment (packageCredit IS NULL ∧ no UPFRONT/INSTALLMENTS link ∧ no promo link). **`ReportRevenueReconciliationTest`** (`backend/src/test/java/daviderocca/beautyroom/ReportRevenueReconciliationTest.java`, ~330 lines) builds 5 scenarios (online package 300, in-store bundle 45 with customTotalPrice, paid sale 40, refund net-0 + refundsTotal 50, online order 25) and asserts per-leg totals, grand total 410, channel split, heatmap-sum == trattamenti leg, empty pipeline/arretrati. **It never mentions staff — it stays green as long as the no-filter path is byte-identical.**

### 1.H Emails

Outbox pattern: `EmailOutboxService` (plain `@Transactional` enqueue; unique `uk_email_event_agg`; reschedule-on-move for 24h reminder) → `EmailOutboxWorker` poll → Mailgun. Templates in `BE:email/templates/EmailTemplateService.java` (pure-HTML builders; `bookingConfirmed` at ~78–101; assembler mirrors agenda card). Recipient resolution: `recipientFor(booking)` inside the outbox service — **do not touch** (R12).

### 1.I Full admin-capability inventory (feeds the permission matrix)

30 controllers found. Admin-protected: `AdminBookingController`, `AdminAgendaDayController`, `CustomerController` (`/admin/customers`), `WorkingHoursController`, `ClosureController`, `PostItController`, `AdminNotificationController` (also `/api/notifications`), `ReportController`, `AdminPackageController`, `PersonalAppointmentController`, `BookingSaleController`, admin methods of: `BookingController` (consent, pmu-unsigned, no-show), `OrderController`, `ProductController`, `ServiceItemController`, `CategoryController`, `PromotionController`, `ResultController`, `UserController` (list/email-lookup/verify/make-admin/remove-admin), `AppSettingsController` (PATCH), `WishlistController` (1 admin method). Public: `PublicController`, `AvailabilityController` (GET), `WaitlistController`, `StockAlertController`, `StripeWebhookController`, `BookingCheckoutController`/`PaymentController` (route-rule mix), `HealthController`, `AuthController`.

---

## 2. Target architecture

### 2.1 Entities (text ERD)

```
staff_members                          ← new
  id UUID PK
  user_id UUID NULL UNIQUE FK→users(user_id)     -- login account (STAFF user, or Michela's ADMIN user)
  display_name VARCHAR(80) NOT NULL              -- "Michela", "Giulia"
  color VARCHAR(7) NULL                          -- agenda accent
  active BOOLEAN NOT NULL DEFAULT true
  sort_order INT NOT NULL DEFAULT 0
  created_at / updated_at

staff_services (staff_id FK CASCADE, service_id FK→services CASCADE, PK(staff_id, service_id))   ← new (R4)

staff_working_hours                    ← new (R5) — per-staff copy of working_hours shape
  id UUID PK · staff_id FK CASCADE · day_of_week VARCHAR NOT NULL
  morning_start/morning_end/afternoon_start/afternoon_end TIME NULL · closed BOOLEAN NOT NULL DEFAULT false
  UNIQUE(staff_id, day_of_week)

bookings              + staff_id UUID NULL FK→staff_members  (backfill → app always writes → NOT NULL in final hardening)
personal_appointments + staff_id UUID NULL FK→staff_members  (backfill → NOT NULL in final hardening)
booking_sales         + staff_id UUID NULL FK→staff_members  (backfill; stays nullable: NULL = unattributed)
closures              + staff_id UUID NULL FK→staff_members  (NULL = salon-wide closure; non-NULL = staff absence — reuses range+partial-day machinery)

users.role: enum gains STAFF (CUSTOMER | ADMIN | STAFF). ADMIN stays the owner's value (§0.4).
UNTOUCHED (R7): package_credits, client_package_assignments, booking_package_link, package_installments, orders, working_hours (frozen legacy, see §3).
```

**Staff identity resolution:** authenticated User → `staffMemberRepository.findByUserId(...)` (a small `CurrentStaffService`). Michela's ADMIN user links to her staff row. **Active-staff gate (I1):** `staffMemberRepository.countByActiveTrue()` — every conditional surface (pickers, columns, public step, email line) keys off `activeCount >= 2`. FE mirror: `GET /api/public/staff` (list of active staff) + staff info in admin bootstrap.

**Core behavioral change:** occupancy/conflict becomes **per-staff** (two active staff ⇒ two parallel bookings are legal). Every surface in §1.C's table gains a staff dimension; "prima disponibile"/no-choice = union of qualified active staff, resolved to a concrete staff at booking-persist time (SERIALIZABLE re-check). Legacy safety: a booking row with `staff_id NULL` (should not exist after backfill) blocks **all** staff.

### 2.2 Permission matrix (OWNER = role `ADMIN`; STAFF = new role)

⚠️ = needs Michela/Davide confirmation; recommended default shown. "O" = owner-only, "O+S" = both.

| #   | Capability (where)                                                                                                                 | OWNER | STAFF | Rationale / default                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Agenda read: day/range/timeline/PA read (`AdminBookingController`, `AdminAgendaDayController`, `AvailabilityController` admin GET) | ✓     | ✓     | R2 core                                                                                                      |
| 2   | Booking create/edit/move (`/admin/bookings/manual`, `/create`, `PUT /{id}`) incl. package links, custom service, promos-in-booking | ✓     | ✓     | R2 core; service-layer guards at `BookingService:391/506/1816` must accept STAFF                             |
| 3   | Status transitions: complete / un-complete (today-only) / no-show / cancel (`PATCH /status`, `BookingController` no-show)          | ✓     | ✓     | R2; guard `BookingService:2296`                                                                              |
| 4   | Settlement + installment editing (`PATCH /settle`, installment endpoints)                                                          | ✓     | ✓     | R2 explicitly includes settlement; guard `:2419`                                                             |
| 5   | Hard delete booking (`DELETE /admin/bookings/{id}`)                                                                                | ✓     | ✗ ⚠️  | Destructive (R3); cancel covers daily needs. Guard `:1470` stays owner-only                                  |
| 6   | Refund (`POST /{id}/refund`, order refund endpoints)                                                                               | ✓     | ✗ ⚠️  | Money-destructive (R3)                                                                                       |
| 7   | PMU/laser consent sign + pmu-unsigned list                                                                                         | ✓     | ✓     | Daily ops                                                                                                    |
| 8   | Padding / reminder patches                                                                                                         | ✓     | ✓     | Daily ops                                                                                                    |
| 9   | PersonalAppointments — own                                                                                                         | ✓     | ✓     | R5                                                                                                           |
| 10  | PersonalAppointments — of other staff                                                                                              | ✓     | ✗ ⚠️  | Owner arbitrates; avoids accidental cross-edits. Default: STAFF own-only                                     |
| 11  | Slot finder / available-slots (admin)                                                                                              | ✓     | ✓     | R2                                                                                                           |
| 12  | Clients Hub: search/create/summary/history/notes (`/admin/customers/**`)                                                           | ✓     | ✓     | R2 core                                                                                                      |
| 13  | Orders: list/detail/status/pay-in-store handling (`OrderController` admin methods)                                                 | ✓     | ✓ ⚠️  | Shop pickup is daily ops; **refund stays O** (#6). Guards `OrderService:108/241/328`                         |
| 14  | Product catalog CRUD/reorder/toggle-active (`ProductController` writes)                                                            | ✓     | ✗     | R3 catalog                                                                                                   |
| 15  | Service catalog + options + categories CRUD (`ServiceItemController`, `CategoryController` writes)                                 | ✓     | ✗     | R3 catalog                                                                                                   |
| 16  | Promotions CRUD (`PromotionController` writes)                                                                                     | ✓     | ✗     | R3 catalog (attach-in-booking is #2, O+S)                                                                    |
| 17  | Results/gallery CRUD (`ResultController` writes)                                                                                   | ✓     | ✗ ⚠️  | Content mgmt; revisit later                                                                                  |
| 18  | Packages: create assignment / attach in drawer (rides #2)                                                                          | ✓     | ✓     | Daily ops                                                                                                    |
| 19  | Recurring package templates CRUD (`AdminPackageController`)                                                                        | ✓     | ✗ ⚠️  | Pricing-adjacent config                                                                                      |
| 20  | Working hours — global legacy + per-staff (`WorkingHoursController`, new Team API)                                                 | ✓     | ✗     | R3: per-staff hours are owner-managed                                                                        |
| 21  | Closures (global) + staff absences (`ClosureController`)                                                                           | ✓     | ✗     | R3 Impostazioni                                                                                              |
| 22  | App settings (cancellation policy…) (`AppSettingsController` PATCH)                                                                | ✓     | ✗     | R3                                                                                                           |
| 23  | Reports (`/admin/report`)                                                                                                          | ✓     | ✗ ⚠️  | R10 proposal: **none in v1** (menu hidden, endpoint owner-only). "Own production" is a later additive filter |
| 24  | Admin notifications (`AdminNotificationController`)                                                                                | ✓     | ✓ ⚠️  | New-booking alerts are operational; salon-wide feed shared                                                   |
| 25  | Post-it board (`PostItController`)                                                                                                 | ✓     | ✓ ⚠️  | Shared whiteboard by nature                                                                                  |
| 26  | User verification toggle (`PATCH /users/{id}/verify`)                                                                              | ✓     | ✗     | R3                                                                                                           |
| 27  | Users admin: list / email lookup / make-admin / remove-admin / delete (`UserController`)                                           | ✓     | ✗     | Identity mgmt                                                                                                |
| 28  | Team management: staff CRUD, activate/deactivate, service assignments, per-staff hours/absences (new)                              | ✓     | ✗     | R3 core                                                                                                      |
| 29  | Wishlist/stock-alert admin methods, uploads riding catalog                                                                         | ✓     | ✗     | Follows catalog                                                                                              |
| 30  | Booking product-sale lines in drawer (rides #2/#4)                                                                                 | ✓     | ✓     | R9                                                                                                           |

**Agenda visibility for STAFF: full salon agenda (all staff), including creating/editing bookings for other staff** ⚠️ — recommended default _yes_ (a 2–3 person salon answers the phone for each other); the alternative (own-column-only) would break reception workflows.

### 2.3 API surface changes (all additive)

The four duration-only availability surfaces (combined, available-slots, day-status, next-combined) additionally gain optional `serviceIds` for qualified-union in ANY mode (amendment 2026-07-02 — closes the read-side over-promise of risk 8).

- **New (owner-only unless noted):** `GET/POST /admin/staff` · `PUT /admin/staff/{id}` · `PATCH /admin/staff/{id}/active` · `GET/PUT /admin/staff/{id}/services` · `GET/PUT /admin/staff/{id}/working-hours` · staff absences via `POST /closures` with `staffId` · **public** `GET /api/public/staff?serviceId=` (active staff, display name + id + color, optionally filtered by qualification).
- **Extended (param/field additive, absent ⇒ legacy semantics):** all §1.C read surfaces gain optional `staffId` (or `staffId=ANY`); `AdminBookingCreateDTO` + `NewBookingDTO` gain `staffId`; `AdminBookingCardDTO` gains `staffId`+`staffName` (1 construction site); PA DTOs gain `staffId`; `PublicMultiServiceBookingDTO` gains `staffId`; checkout session metadata gains `staffId` (or `ANY`); `/users/me` response gains `staffId`; booking confirmation email model gains optional staff display name.

### 2.4 Frontend changes per area

- **Auth/nav:** `PrivateRoute roles={["ADMIN"]}` → `["ADMIN","STAFF"]` on shared screens (workspace, notifiche); owner-only screens keep `["ADMIN"]` (impostazioni, report, team, catalog editing affordances in public pages). NavBar renders the reduced STAFF menu.
- **Team UI (new, owner):** standalone page `/admin/team` — staff list, create (name/email/password/color), deactivate, service assignment checklist, per-staff hours editor (reuse the Impostazioni hours editor pattern), absences.
- **Agenda:** day view becomes **per-staff columns** when `activeStaff ≥ 2` (single shared time axis; 2–3 columns fit iPad landscape; ≥4 ⇒ horizontal scroll with `data-lenis-prevent`; staff header chips double as focus filter). Week view stays merged with **per-staff color stripe** + staff filter chips. Cards get a staff badge. With 1 active staff: **pixel-identical to today** (I1).
  _Why columns win on iPad:_ placing a walk-in requires seeing simultaneous free gaps across operators at a glance — a switcher hides exactly that; chips-only filtering loses the side-by-side comparison; columns keep tap targets ≥ today's size and reuse the existing %-positioning math per column unchanged.
- **Drawer:** staff selector (chips) right after the customer block, before services — filters the service list per qualification and feeds `staffId` to slot fetches; hidden when 1 active staff; EDIT pre-fills from booking.
- **Public booking:** new step "Con chi vuoi prenotare?" (chips: each active qualified staff + "Prima disponibile", default selected) **before date selection** in BookingModal, MultiServiceBookingModal, and the `/prenota` route shell (shared BookingFlow step component); `useFullDays` + slot grids + `useNextCombinedSlot` pass `staffId`; changing staff resets date/slot state (same reset pattern as duration change). Step hidden when <2 active qualified staff.
- **Reports (owner):** staff filter dropdown + per-staff breakdown card (with explicit "Non attribuito" bucket).

---

## 3. Migration & backfill plan

Version placeholders VNN/VNN+1/VNN+2 — **first action of the implementing session: `SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5` on production** (Davide runs it) to confirm VNN = 82; if prod shows anything ≥82, renumber.

1. **VNN — staff core (idempotent, collision-guarded):** create `staff_members`, `staff_services`, `staff_working_hours`; seed Michela: `INSERT … SELECT` from `users WHERE role='ADMIN'` (guard: exactly-one-admin check via `DO $$ … RAISE` like V73/V80; abort loudly otherwise); copy the 7 `working_hours` rows into `staff_working_hours` for her; insert `staff_services` = every row of `services` for her. _Rollback:_ drop the three tables.
2. **VNN+1 — staff_id columns + backfill:** `ALTER TABLE bookings/personal_appointments/booking_sales/closures ADD COLUMN staff_id UUID NULL REFERENCES staff_members(id)`; backfill bookings/personal*appointments/booking_sales to Michela's id; leave `closures.staff_id` NULL (=global). Indexes: `bookings(staff_id, start_time)`, `personal_appointments(staff_id, appointment_date)`, `booking_sales(staff_id)`, partial on `closures(staff_id) WHERE staff_id IS NOT NULL`. \_Rollback:* drop columns + indexes.
3. **App-level from prompt 01 onward:** every new Booking/PersonalAppointment/BookingSale write sets `staff` (default = the single active staff) so **no NULL rows accumulate** between prompts.
4. **VNN+2 — final hardening (prompt 13):** precondition `SELECT count(*) … WHERE staff_id IS NULL` = 0 on bookings + personal*appointments (guarded in-migration via `DO $$ RAISE`), then `SET NOT NULL` on those two. `booking_sales.staff_id` and `closures.staff_id` stay nullable by design. \_Rollback:* `DROP NOT NULL`.
5. `working_hours` (legacy table) is left in place and **frozen** once the engine reads `staff_working_hours` (prompt 06); the Impostazioni hours editor repoints to the owner's staff hours (prompt 04). Removal is deliberately out of scope.

Applied like V80: **Davide runs migrations manually local → prod**; prompts never auto-apply.

---

## 4. Risk register (ranked)

| #   | Risk                                                                                                                      | Mitigation                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Money path breakage** (metadata/webhook staff propagation corrupts booking creation, refunds, package purchase)         | Prompt 10 is single-concern with STOP valves; metadata absent ⇒ fallback to single-active/owner staff (backward compatible with in-flight sessions at deploy); insert-first idempotency untouched; tombstone path untouched; FE (09) ships before BE (10) safely because Jackson ignores unknown DTO fields and I1 hides the step |
| 2   | **Per-staff conflict correctness** — double-booking a staff, or phantom-blocking across staff                             | All 9 surfaces (§1.C) enumerated; SERIALIZABLE preserved on every write path; parity tests: with 1 active staff, engine output must equal pre-refactor output (characterization tests written first in prompt 06); NULL staff blocks everyone                                                                                     |
| 3   | **Prod migration/backfill** (V-numbering collision, partial backfill, >1 admin row)                                       | §3 guards (`DO $$ RAISE` aborts), version re-verification against prod history, rollback notes, Davide applies manually local→prod                                                                                                                                                                                                |
| 4   | **I1 leakage** — staff UI appearing while only Michela is active                                                          | Single gate source (`activeCount >= 2`) BE + one FE hook; per-checkpoint I1 checklist in 99-execution-guide; grep-able gate helper                                                                                                                                                                                                |
| 5   | **RBAC sweep gaps** — a missed `isAdmin`/`hasRole('ADMIN')` blocks STAFF (R2 broken) or over-grants (R3 broken)           | Full inventory in §0.4/§2.2; prompt 02 works from that checklist + adds STAFF-access tests on representative endpoints per matrix row                                                                                                                                                                                             |
| 6   | **Agenda perf regression** (N staff ⇒ N× queries)                                                                         | Keep single day/range query; group client-side by `staffId`; PA day/week fetch stays one call (gains staff field); no new N+1 (`AdminBookingCardDTO` already denormalized)                                                                                                                                                        |
| 7   | **Edge flows dropping staff** — waitlist deep-link re-entry, drawer EDIT reset, duplicate booking, hold-expiry re-confirm | Explicit acceptance criteria in prompts 08/09/10; hold row carries staff from creation                                                                                                                                                                                                                                            |
| 8   | **Union availability overpromise** — "prima disponibile" slot taken between checkout and webhook                          | Already-existing PAID_CONFLICT machinery is per-staff after 06; ANY resolved at SERIALIZABLE persist time picks any free qualified staff before conflict-cancelling                                                                                                                                                               |

---

## 5. Open decisions — ALL CONFIRMED 2026-07-02 (Davide, with Michela's operating context)

1. Role naming — CONFIRMED: keep `ADMIN` as the owner's stored role; UI label "Titolare". No rename.
2. STAFF report access — CONFIRMED: none in v1. `/admin/report` owner-only; menu entry hidden for STAFF.
3. STAFF agenda scope — CONFIRMED: full salon agenda; STAFF can create/edit bookings for any staff (reception workflow).
4. Destructive set — CONFIRMED: hard-delete + refunds owner-only; complete/un-complete/settle/no-show also STAFF.
5. Public step — CONFIRMED: "Prima disponibile" preselected; active qualified staff listed by `sort_order`
   (owner controls order); display name only in v1. Chosen staff name shown in booking summary/success (09)
   and in confirmation emails (12), gated on ≥2 active staff.
6. ANY-staff resolution — CONFIRMED: least-loaded qualified staff that day; tie → lowest sort_order.
7. Absences — CONFIRMED: per-staff Closure (vacations / full or multi-day) + PersonalAppointment (ad-hoc blocks).
8. Physical capacity — CONFIRMED as operating rule: real stations (mani, piedi, laser/cabina) are single-occupancy,
   so each station-bound service is assigned to EXACTLY ONE active staff member (v1 reality: collaborator = all
   mani/piedi services exclusively, Michela removes herself from those; laser/viso/rest = Michela only).
   With one person per service, per-staff conflicts are equivalent to station conflicts.
   The SYSTEM does not enforce this exclusivity in v1 — engine stays staff-capacity only; NO change to prompt 06 scope.
9. Product-sale attribution — CONFIRMED: sale inherits the booking's staff.
10. Deactivation with future bookings — CONFIRMED: block + return the blocking list to reassign.

All ⚠️ permission-matrix cells — CONFIRMED as the recommended defaults (incl. full-agenda visibility note).

### Post-13 backlog (additive, out of scope for prompts 01–13)

- Staff photos: `staff_members.photo_url` (Cloudinary), upload in Team UI, photo chips in the public step, avatars in agenda headers.
- Station/resource model: `services.resource_group` (or stations table) + station-overlap predicate in the conflict engine,
  to safely allow the same service/station on 2+ staff; optional Team-UI warning when a service is assigned to 2+ staff.

---

## 6. Implementation prompts & sequencing

13 prompts, every one ends with backend tests green (116 baseline + new), `test-compile` clean, FE build green, and is a **merge checkpoint** (shippable under I1). Never mix Stripe/webhook work with anything else (only prompt 10 touches it).

| #   | file                                   | concern                                                                                    | layer       |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| 01  | `01-schema-staff-entities-backfill.md` | VNN/VNN+1 + entities/repos + default-staff on all writes (inert)                           | BE+SQL      |
| 02  | `02-rbac-staff-role.md`                | `STAFF` role + authorization sweep + CurrentStaffService + `/users/me`                     | BE          |
| 03  | `03-team-backend-api.md`               | staff CRUD, assignments, per-staff hours, absences, public staff list                      | BE          |
| 04  | `04-team-owner-ui.md`                  | "Team" admin page                                                                          | FE          |
| 05  | `05-personal-appointment-gap-fix.md`   | PA blocks in admin finder + single-service public slots (+timeline DTO)                    | BE          |
| 06  | `06-availability-engine-per-staff.md`  | staff-parameterize all 9 surfaces + write-path conflicts; parity gates                     | BE          |
| 07  | `07-agenda-multi-staff-ui.md`          | day columns + chips + week colors + card badge                                             | FE(+DTO)    |
| 08  | `08-admin-drawer-staff-writes.md`      | drawer picker, create/edit staffId + qualification validation, move across staff, PA staff | FE+BE       |
| 09  | `09-public-booking-staff-step.md`      | public staff step + staff params on public reads + pay-in-store write                      | FE(+BE dto) |
| 10  | `10-money-path-staff-propagation.md`   | Stripe metadata + webhook persist (incl. package purchase) — **money, single-concern**     | BE          |
| 11  | `11-report-staff-dimension.md`         | optional staff filter + per-staff breakdown; reconciliation intact                         | BE+FE       |
| 12  | `12-emails-staff-name.md`              | staff name in confirmation/reschedule templates (≥2 gate)                                  | BE          |
| 13  | `13-hardening-not-null-i1-sweep.md`    | VNN+2 NOT NULL + final I1 sweep                                                            | BE+SQL      |

Rationale vs the suggested shape in the brief: identical ordering, with the PA-gap fix pulled **before** the per-staff refactor (05→06) so the parity gate in 06 is meaningful (behavior change lands first, then the refactor must be behavior-preserving), and product-sale attribution folded into 01/08/10 (sale inherits booking's staff — no separate prompt needed).
