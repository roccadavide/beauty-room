import { AGENDA_ENDPOINTS, AVAIL_ENDPOINTS, BOOKING_ENDPOINTS } from "../endpoints";
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
