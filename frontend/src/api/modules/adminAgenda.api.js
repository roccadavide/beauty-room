import { AGENDA_ENDPOINTS, AVAIL_ENDPOINTS, BOOKING_ENDPOINTS_ADMIN, CLOSURE_ENDPOINTS, PACKAGE_ASSIGNMENT_ENDPOINTS, PERSONAL_APPT_ENDPOINTS, WORKING_HOURS_ENDPOINTS } from "../endpoints";
import http from "../httpClient";

/* ================= TIMELINE ================= */
export const getTimelineDay = async date => {
  try {
    const { data } = await http.get(AGENDA_ENDPOINTS.TIMELINE_DAY, { params: { date } });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare la timeline.";
    throw new Error(message);
  }
};

/* ================= AGENDA BOOKINGS (ADMIN) ================= */
export const getBookingsDay = async date => {
  try {
    const { data } = await http.get(AGENDA_ENDPOINTS.BOOKINGS_DAY, { params: { date } });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le prenotazioni del giorno.";
    throw new Error(message);
  }
};

export const getBookingsRange = async (from, to) => {
  try {
    const { data } = await http.get(AGENDA_ENDPOINTS.BOOKINGS_RANGE, { params: { from, to } });
    return Array.isArray(data) ? data : data?.content ?? [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le prenotazioni.";
    throw new Error(message);
  }
};

export const patchBookingStatus = async (id, status) => {
  try {
    const { data } = await http.patch(AGENDA_ENDPOINTS.BOOKING_STATUS(id), null, { params: { status } });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore aggiornamento stato prenotazione.";
    throw new Error(message);
  }
};

// PATCH settle — registra il pagamento per-riga (completion drawer), opzionalmente
// completando l'appuntamento (alsoComplete). Backend: PATCH /admin/bookings/{id}/settle
export const settleBookingLines = async (id, payload) => {
  try {
    const { data } = await http.patch(AGENDA_ENDPOINTS.BOOKING_SETTLE(id), payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore registrazione pagamento.";
    throw new Error(message);
  }
};

// GET arretrati del cliente di un booking (lazy-load per il dropdown agenda).
// Backend: GET /admin/bookings/{id}/arretrati -> List<ArretratoLineDTO> (kind/refId arricchiti).
export const fetchArretratiForBooking = async id => {
  try {
    const { data } = await http.get(AGENDA_ENDPOINTS.BOOKING_ARRETRATI(id));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Errore caricamento arretrati.";
    throw new Error(message);
  }
};

export const updateBooking = async (id, payload) => {
  try {
    const { data } = await http.put(AGENDA_ENDPOINTS.BOOKING_BY_ID(id), payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore aggiornamento prenotazione.";
    throw new Error(message);
  }
};

export const patchBookingPadding = async (id, minutes) => {
  try {
    const params = minutes != null && minutes > 0 ? { minutes } : {};
    await http.patch(`/admin/bookings/${id}/padding`, null, { params });
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore aggiornamento buffer.";
    throw new Error(message);
  }
};

// PATCH reminder — segna/annulla l'invio del promemoria WhatsApp
export const patchBookingReminder = async (id, sent) => {
  try {
    const { data } = await http.patch(`/admin/bookings/${id}/reminder`, { sent });
    return data; // { bookingId, reminderSentAt }
  } catch (error) {
    const message = error.response?.data?.message || "Errore aggiornamento promemoria.";
    throw new Error(message);
  }
};

export const deleteBooking = async id => {
  try {
    await http.delete(AGENDA_ENDPOINTS.BOOKING_BY_ID(id));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore eliminazione prenotazione.";
    throw new Error(message);
  }
};

export const patchBookingConsent = async id => {
  try {
    const { data } = await http.patch(`/bookings/${id}/consent`, { signed: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore firma consenso PMU.";
    throw new Error(message);
  }
};

export const refundBooking = async id => {
  try {
    const { data } = await http.post(`/admin/bookings/${id}/refund`);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante il rimborso della prenotazione.";
    throw new Error(message);
  }
};

export const getNextAvailableSlot = async (durationMin, afterISO, filters = null) => {
  const params = { durationMin };
  if (afterISO) params.after = afterISO;

  if (filters) {
    const { daysOfWeek, windowStart, windowEnd } = filters;
    if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
      params.daysOfWeek = daysOfWeek.join(",");
    }
    if (windowStart) params.windowStart = windowStart;
    if (windowEnd) params.windowEnd = windowEnd;
  }

  try {
    const { data } = await http.get(AGENDA_ENDPOINTS.NEXT_AVAILABLE, { params });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile cercare la prossima disponibilità.";
    throw new Error(message);
  }
};

/* ================= MULTI-SERVICE BOOKINGS (ADMIN) ================= */
export const createMultiServiceBooking = async payload => {
  try {
    const { data } = await http.post(BOOKING_ENDPOINTS_ADMIN.CREATE_MULTI, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore creazione appuntamento.";
    throw new Error(message);
  }
};

export const getAdminAvailableSlots = async (date, durationMinutes, excludeBookingId = null) => {
  try {
    const params = { date, durationMinutes };
    if (excludeBookingId) params.excludeBookingId = excludeBookingId;
    const { data } = await http.get(BOOKING_ENDPOINTS_ADMIN.AVAILABLE_SLOTS, { params });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile caricare gli slot disponibili.";
    throw new Error(message);
  }
};

export const getClientPackageAssignmentsByName = async name => {
  try {
    const { data } = await http.get(PACKAGE_ASSIGNMENT_ENDPOINTS.CLIENT, { params: { name } });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile caricare i pacchetti del cliente.";
    throw new Error(message);
  }
};

/* ================= PERSONAL APPOINTMENTS (ADMIN) ================= */
export const getPersonalAppointmentsDay = async date => {
  try {
    const { data } = await http.get(PERSONAL_APPT_ENDPOINTS.BASE, { params: { date } });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare gli appuntamenti personali.";
    throw new Error(message);
  }
};

export const getPersonalAppointmentsWeek = async start => {
  try {
    const { data } = await http.get(PERSONAL_APPT_ENDPOINTS.WEEK, { params: { start } });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare gli appuntamenti personali della settimana.";
    throw new Error(message);
  }
};

export const createPersonalAppointment = async payload => {
  try {
    const { data } = await http.post(PERSONAL_APPT_ENDPOINTS.BASE, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore creazione appuntamento personale.";
    throw new Error(message);
  }
};

export const updatePersonalAppointment = async (id, payload) => {
  try {
    const { data } = await http.put(PERSONAL_APPT_ENDPOINTS.BY_ID(id), payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore aggiornamento appuntamento personale.";
    throw new Error(message);
  }
};

export const deletePersonalAppointment = async id => {
  try {
    await http.delete(PERSONAL_APPT_ENDPOINTS.BY_ID(id));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore eliminazione appuntamento personale.";
    throw new Error(message);
  }
};

/* ================= AVAILABILITY ================= */
export const getAvailSlotsForServiceDay = async (serviceId, date) => {
  try {
    const { data } = await http.get(AVAIL_ENDPOINTS.SERVICE_SLOTS(serviceId), { params: { date } });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Non riesco a caricare gli slot disponibili.";
    throw new Error(message);
  }
};

/* ================= CLOSURES (ADMIN) ================= */
export const getClosuresRange = async (from, to) => {
  try {
    const { data } = await http.get(CLOSURE_ENDPOINTS.BASE, { params: { from, to } });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le chiusure.";
    throw new Error(message);
  }
};

export const createClosure = async payload => {
  try {
    const { data } = await http.post(CLOSURE_ENDPOINTS.BASE, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore creazione chiusura.";
    throw new Error(message);
  }
};

export const updateClosure = async (id, payload) => {
  try {
    const { data } = await http.put(CLOSURE_ENDPOINTS.BY_ID(id), payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore aggiornamento chiusura.";
    throw new Error(message);
  }
};

export const deleteClosure = async id => {
  try {
    await http.delete(CLOSURE_ENDPOINTS.BY_ID(id));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore eliminazione chiusura.";
    throw new Error(message);
  }
};

/**
 * Returns the count + light list of active bookings that overlap a (proposed
 * or existing) closure range. Informational only — never blocks saving.
 * Backend: POST /closures/preview → { overlappingBookingsCount, overlappingBookings: [...] }
 */
export const previewClosureConflicts = async payload => {
  try {
    const { data } = await http.post(`${CLOSURE_ENDPOINTS.BASE}/preview`, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile verificare i conflitti.";
    throw new Error(message);
  }
};

/* ================= WORKING HOURS (ADMIN) ================= */
export const getWorkingHoursAll = async () => {
  try {
    const { data } = await http.get(WORKING_HOURS_ENDPOINTS.BASE);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare gli orari di lavoro.";
    throw new Error(message);
  }
};

export const initDefaultWeek = async () => {
  try {
    const { data } = await http.post(`${WORKING_HOURS_ENDPOINTS.BASE}/init-default-week`);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore inizializzazione settimana di default.";
    throw new Error(message);
  }
};

export const updateWorkingHours = async (id, payload) => {
  try {
    const { data } = await http.put(`${WORKING_HOURS_ENDPOINTS.BASE}/${id}`, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore aggiornamento orari di lavoro.";
    throw new Error(message);
  }
};

/* ================= CATALOGUE PACKAGES ================= */
export const fetchCatalogPackages = async () => {
  try {
    const { data } = await http.get("/service-items/options/packages");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile caricare i pacchetti catalogo.";
    throw new Error(message);
  }
};

/* ================= PACKAGE ASSIGNMENTS ================= */
export const createPackageAssignment = async payload => {
  try {
    const { data } = await http.post("/admin/package-assignments", payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione del pacchetto.";
    throw new Error(message);
  }
};

export const cancelPackageAssignment = async assignmentId => {
  try {
    await http.delete(`/admin/package-assignments/${assignmentId}/cancel`);
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la cancellazione del pacchetto.";
    throw new Error(message);
  }
};

export const updatePackageAssignment = async (assignmentId, payload) => {
  try {
    const { data } = await http.put(`/admin/package-assignments/${assignmentId}`, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'aggiornamento del pacchetto.";
    throw new Error(message);
  }
};

/* ================= RECURRING PACKAGE TEMPLATES ================= */
export const fetchRecurringTemplates = async () => {
  try {
    const { data } = await http.get("/admin/recurring-package-templates");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile caricare i template ricorrenti.";
    throw new Error(message);
  }
};

export const createRecurringTemplate = async payload => {
  try {
    const { data } = await http.post("/admin/recurring-package-templates", payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante il salvataggio del template ricorrente.";
    throw new Error(message);
  }
};

export const archiveRecurringTemplate = async id => {
  try {
    await http.delete(`/admin/recurring-package-templates/${id}`);
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'archiviazione del template ricorrente.";
    throw new Error(message);
  }
};

/* ================= PACKAGE INSTALLMENTS ================= */
// Installments due in a date window (the agenda queries [date, date]).
// Backend: GET /admin/package-installments/due?from=&to= ->
//   [{ installmentId, packageAssignmentId, clientName, packageName, amount, dueDate, total, remaining }]
export const getInstallmentsDue = async (from, to) => {
  try {
    const { data } = await http.get("/admin/package-installments/due", { params: { from, to } });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Errore caricamento rate in scadenza.";
    throw new Error(message);
  }
};

// Batched per-package summaries for the agenda's always-on "Pagato €X su €Y" pill.
// Backend: GET /admin/package-installments/summaries?ids=uuid1,uuid2 ->
//   [{ packageAssignmentId, total, collected, remaining, fullyPaid, hasOpenDue }]
export const getPackageInstallmentSummaries = async ids => {
  if (!ids?.length) return []; // never hit the endpoint with no ids
  try {
    const { data } = await http.get("/admin/package-installments/summaries", { params: { ids: ids.join(",") } });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Errore caricamento riepilogo rate.";
    throw new Error(message);
  }
};

// Register the payment of one installment.
// Backend: PATCH /admin/package-assignments/{assignmentId}/installments/{installmentId}/settle  body { paidDate }
export const settlePackageInstallment = async (assignmentId, installmentId, body) => {
  try {
    const { data } = await http.patch(`/admin/package-assignments/${assignmentId}/installments/${installmentId}/settle`, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante il saldo della rata.";
    throw new Error(message);
  }
};

// Full installment list for one package assignment (the rate editor).
// Backend: GET /admin/package-assignments/{assignmentId}/installments -> PackageInstallmentDTO[]
export const getPackageInstallments = async assignmentId => {
  try {
    const { data } = await http.get(`/admin/package-assignments/${assignmentId}/installments`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Errore caricamento rate.";
    throw new Error(message);
  }
};

// Residuo / incassato roll-up for one package assignment.
// Backend: GET .../installments/summary -> PackageInstallmentSummaryDTO
export const getPackageInstallmentSummary = async assignmentId => {
  try {
    const { data } = await http.get(`/admin/package-assignments/${assignmentId}/installments/summary`);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore caricamento riepilogo rate.";
    throw new Error(message);
  }
};

// Add a rata. Backend: POST .../installments (PackageInstallmentRequestDTO) -> 201 PackageInstallmentDTO
export const createPackageInstallment = async (assignmentId, body) => {
  try {
    const { data } = await http.post(`/admin/package-assignments/${assignmentId}/installments`, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della rata.";
    throw new Error(message);
  }
};

// Edit a rata. Backend: PUT .../installments/{installmentId} (PackageInstallmentRequestDTO) -> PackageInstallmentDTO
export const updatePackageInstallment = async (assignmentId, installmentId, body) => {
  try {
    const { data } = await http.put(`/admin/package-assignments/${assignmentId}/installments/${installmentId}`, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'aggiornamento della rata.";
    throw new Error(message);
  }
};

// Revert a settled rata back to unpaid. Backend: PATCH .../installments/{installmentId}/unsettle
export const unsettlePackageInstallment = async (assignmentId, installmentId) => {
  try {
    const { data } = await http.patch(`/admin/package-assignments/${assignmentId}/installments/${installmentId}/unsettle`);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'annullamento del saldo.";
    throw new Error(message);
  }
};

// Remove a rata. Backend: DELETE .../installments/{installmentId} -> 204
export const deletePackageInstallment = async (assignmentId, installmentId) => {
  try {
    await http.delete(`/admin/package-assignments/${assignmentId}/installments/${installmentId}`);
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'eliminazione della rata.";
    throw new Error(message);
  }
};
