# Prompt 12 — Emails: staff display name in booking confirmation/reschedule (minimal, R12)

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.H, R12). That report + this file are your only context. `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

Customer-facing booking **confirmation** and **rescheduled** emails mention the assigned staff member ("Ti aspetta **Giulia**") — only when ≥2 active staff exist (with one staff it adds nothing and I1 demands silence). Nothing else in the email system changes; the **recipient-resolution chain is untouchable**.

## In scope
- `BE:email/` — the booking email model/assembler (grep `BookingEmailModel`, `BookingEmailAssembler`, `bookingConfirmed`, `bookingRescheduled` in `BE:email/templates/EmailTemplateService.java` ≈78–101 and the outbox service that builds models): add an optional `staffDisplayName` field, populated from `booking.getStaffMember()` **only when** `staffMemberRepository.countByActiveTrue() >= 2`; null ⇒ template renders exactly today's HTML (assert byte-identical for null).
- Template: one discreet line near the date/time block ("Ti aspetta {staffDisplayName}") in `bookingConfirmed` + `bookingRescheduled` builders, rendered only when non-null. Match the existing inline-CSS style and Italian copy tone; dual light/dark palette rules as the file already does.
- If the model is built inside a `@Transactional` boundary, fetching the LAZY staff name is fine there; if the builder is deliberately DB-free (the report notes a "pure method DB-free" precedent), pass the name in from the enqueue site instead — follow the existing architecture, do not restructure it.

## Out of scope — hard walls
`recipientFor(...)` and anything in recipient resolution (STOP if your diff touches it). Reminder/cancelled/refund/waitlist/order templates. `EmailOutboxWorker`, Mailgun config, outbox schema (no migration!). The unique constraint `uk_email_event_agg`. Any transactional attribute (enqueue is plain `@Transactional` by design — §0.1).

## Context budget
1. `BE:email/templates/EmailTemplateService.java` (bookingConfirmed + rescheduled builders + the model class).
2. `BE:email/outbox/EmailOutboxService.java` (only the enqueue methods that build the booking model — find where the model is assembled).
3. The assembler if separate (grep `BookingEmailAssembler`).
4. Any existing email render test (grep `EmailTemplate` in tests) — extend it.

## Preconditions — STOP rules
- Prompts 01–10 merged (bookings carry staff). If `Booking.getStaffMember()` doesn't exist, STOP.
- If model construction happens in >2 places or outside where the report describes, map them all first; if any is in the webhook controller directly, STOP (that would smell like a money-path edit).
- Zero changes to enqueue signatures used by other call sites unless purely additive with defaults.

## Ordered steps
1. Locate model build site(s); add optional staff name (gated ≥2 active).
2. Template line ×2 builders.
3. Tests: render with name (line present), render with null (byte-identical to a pre-change golden capture — generate the golden FIRST on untouched code), gate OFF ⇒ null even with staff set.

## Landmines
- Email HTML is hand-built strings — keep encoding/escaping consistent with neighbors (staff names are user-supplied: escape like other user fields are escaped; check how customerName is handled and do the same).
- LAZY + `open-in-view=false` — see the architecture note above.
- No `console.log`-equivalents (stray log.info spam) in the render path.

## Acceptance criteria
- ≥2 active staff: confirmation/reschedule emails carry the line; 1 active staff: emails byte-identical to today.
- Recipient chain diff = zero (show `git diff --stat`).

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green. `npm run build` green (untouched).

## Expected diff size
2–3 files, ≈ +80/−5 + small tests.

**MERGE CHECKPOINT: yes.**
**Recommended model/effort:** standard model @ medium.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
