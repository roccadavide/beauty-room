import { AGENDA_ENDPOINTS, AVAIL_ENDPOINTS, CLOSURE_ENDPOINTS, WORKING_HOURS_ENDPOINTS } from "../endpoints";
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

export const patchBookingStatus = async (id, status) => {
  try {
    const { data } = await http.patch(AGENDA_ENDPOINTS.BOOKING_STATUS(id), null, { params: { status } });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore aggiornamento stato prenotazione.";
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

export const deleteBooking = async id => {
  try {
    await http.delete(AGENDA_ENDPOINTS.BOOKING_BY_ID(id));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore eliminazione prenotazione.";
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
