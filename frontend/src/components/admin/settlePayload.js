/**
 * Single source of truth that maps a settle line (kind/refKind + refId) onto a
 * PATCH /admin/bookings/{id}/settle payload, mirroring the backend
 * settleBookingLines + SettlementRequestDTO. Shared by the CompletionDrawer
 * (multi-line, accumulating) and the ClientiPage arretrati panel (single line) so
 * the vocabulary lives in ONE place:
 *
 *   service / legacy → servicePaid        keyed by catalog service_id
 *   package          → packageSessionPaid keyed by ClientPackageAssignment id
 *   custom           → customServicePaid
 *   bundle           → markAllPaid (lockstep, enforced server-side)
 */

/**
 * Mutates `payload`, recording one settle line. The service/package maps are created
 * lazily, so a single-line caller gets a minimal payload (no empty maps). A null
 * refId on a service/package line is skipped (matches the CompletionDrawer behavior).
 * Returns the same payload for chaining.
 */
export function applySettleLine(payload, kind, refId, paid) {
  if (kind === "service" || kind === "legacy") {
    if (refId != null) {
      if (!payload.servicePaid) payload.servicePaid = {};
      payload.servicePaid[String(refId)] = paid;
    }
  } else if (kind === "package") {
    if (refId != null) {
      if (!payload.packageSessionPaid) payload.packageSessionPaid = {};
      payload.packageSessionPaid[String(refId)] = paid;
    }
  } else if (kind === "custom") {
    payload.customServicePaid = paid;
  } else if (kind === "promotion") {
    if (refId != null) {
      if (!payload.promotionPaid) payload.promotionPaid = {};
      payload.promotionPaid[String(refId)] = paid;
    }
  } else if (kind === "bundle") {
    payload.markAllPaid = paid;
  }
  return payload;
}

/**
 * Minimal payload to mark ONE arretrato line as paid from the ClientiPage panel.
 * The booking is already COMPLETED, so alsoComplete defaults to false (the settle
 * must never re-complete it).
 */
export function buildArretratoSettlePayload(arretrato, { alsoComplete = false } = {}) {
  return applySettleLine({ alsoComplete }, arretrato.kind, arretrato.refId, true);
}
