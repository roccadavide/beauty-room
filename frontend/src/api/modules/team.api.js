import http from "../httpClient";
import { STAFF_ENDPOINTS, CLOSURE_ENDPOINTS } from "../endpoints";

/**
 * Team management API (multi-staff prompt 04) — owner-only surface.
 * Backend: StaffController (/admin/staff) + ClosureController (/closures) for
 * per-staff absences (Closure rows carrying a staffId).
 *
 * Errors are rethrown as plain Error carrying `.status` and `.details` (from the
 * httpClient interceptor's `error.normalized`) so callers can branch on 409:
 *   - createStaff duplicate → 409, message holds the reason.
 *   - setStaffActive blocked → 409, details.blockingBookings = [{bookingId,startTime,customerName}].
 */
const rethrow = (error, fallback) => {
  const norm = error?.normalized;
  const e = new Error(norm?.message || error?.response?.data?.message || fallback);
  e.status = norm?.status ?? error?.response?.status ?? 0;
  e.details = norm?.details ?? error?.response?.data?.details ?? null;
  throw e;
};

/* ------------------------------- STAFF CRUD ------------------------------- */

export const getAllStaff = async () => {
  try {
    const { data } = await http.get(STAFF_ENDPOINTS.BASE);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    rethrow(error, "Impossibile recuperare il team.");
  }
};

export const createStaff = async dto => {
  try {
    const { data } = await http.post(STAFF_ENDPOINTS.BASE, dto);
    return data;
  } catch (error) {
    rethrow(error, "Errore durante la creazione del membro del team.");
  }
};

export const updateStaff = async (id, dto) => {
  try {
    const { data } = await http.put(STAFF_ENDPOINTS.BY_ID(id), dto);
    return data;
  } catch (error) {
    rethrow(error, "Errore durante l'aggiornamento del membro del team.");
  }
};

export const setStaffActive = async (id, active) => {
  try {
    const { data } = await http.patch(STAFF_ENDPOINTS.ACTIVE(id), { active });
    return data;
  } catch (error) {
    rethrow(error, "Errore durante la modifica dello stato.");
  }
};

/* --------------------------- SERVICE ASSIGNMENTS -------------------------- */

export const getStaffServices = async id => {
  try {
    const { data } = await http.get(STAFF_ENDPOINTS.SERVICES(id));
    return Array.isArray(data?.serviceIds) ? data.serviceIds : [];
  } catch (error) {
    rethrow(error, "Impossibile recuperare i servizi assegnati.");
  }
};

export const replaceStaffServices = async (id, serviceIds) => {
  try {
    const { data } = await http.put(STAFF_ENDPOINTS.SERVICES(id), { serviceIds });
    return Array.isArray(data?.serviceIds) ? data.serviceIds : [];
  } catch (error) {
    rethrow(error, "Errore durante il salvataggio dei servizi.");
  }
};

/* ------------------------------ WORKING HOURS ----------------------------- */

export const getStaffWorkingHours = async id => {
  try {
    const { data } = await http.get(STAFF_ENDPOINTS.WORKING_HOURS(id));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    rethrow(error, "Impossibile recuperare gli orari.");
  }
};

/** Bulk replace: `payloads` is the full week array of NewWorkingHoursDTO. */
export const updateStaffWorkingHours = async (id, payloads) => {
  try {
    const { data } = await http.put(STAFF_ENDPOINTS.WORKING_HOURS(id), payloads);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    rethrow(error, "Errore durante il salvataggio degli orari.");
  }
};

/* ------------------------- ABSENCES (per-staff Closure) ------------------- */

/**
 * Staff absences reuse the closures API: a Closure with a non-null staffId is
 * that member's absence (decision #7). GET /closures returns all closures; we
 * filter to this staff client-side.
 */
export const getStaffAbsences = async staffId => {
  try {
    const { data } = await http.get(CLOSURE_ENDPOINTS.BASE);
    return (Array.isArray(data) ? data : []).filter(c => c.staffId === staffId);
  } catch (error) {
    rethrow(error, "Impossibile recuperare le assenze.");
  }
};

export const createStaffAbsence = async payload => {
  try {
    const { data } = await http.post(CLOSURE_ENDPOINTS.BASE, payload);
    return data;
  } catch (error) {
    rethrow(error, "Errore durante la creazione dell'assenza.");
  }
};

export const deleteStaffAbsence = async id => {
  try {
    await http.delete(CLOSURE_ENDPOINTS.BY_ID(id));
    return true;
  } catch (error) {
    rethrow(error, "Errore durante l'eliminazione dell'assenza.");
  }
};
