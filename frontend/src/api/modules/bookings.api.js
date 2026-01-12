import { BOOKING_ENDPOINTS, BOOKING_ENDPOINTS_ADMIN } from "../endpoints";
import http from "../httpClient";

/* =======================
   HELPERS
======================= */
const getErrMsg = (error, fallback) => error?.normalized?.message || fallback;

/* =======================
   BOOKINGS (PUBLIC / AUTH)
   Controller: /bookings
======================= */

// CREATE (PUBLIC) - POST /bookings
export const createBooking = async payload => {
  try {
    const { data } = await http.post(BOOKING_ENDPOINTS.BASE, payload);
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Errore durante la creazione della prenotazione."));
  }
};

// UPDATE (AUTH) - PUT /bookings/{bookingId}
export const updateBooking = async (bookingId, payload) => {
  try {
    const { data } = await http.put(BOOKING_ENDPOINTS.BY_ID(bookingId), payload);
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Errore durante l’aggiornamento della prenotazione."));
  }
};

// DELETE (AUTH) - DELETE /bookings/{bookingId}
export const deleteBooking = async bookingId => {
  try {
    await http.delete(BOOKING_ENDPOINTS.BY_ID(bookingId));
    return true;
  } catch (error) {
    throw new Error(getErrMsg(error, "Errore durante l’eliminazione della prenotazione."));
  }
};

export const fetchMyBookings = async () => {
  try {
    const { data } = await http.get(BOOKING_ENDPOINTS.ME);
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Impossibile recuperare le tue prenotazioni."));
  }
};

/* =======================
   BOOKINGS (ADMIN)
   Controller: /admin/bookings
======================= */

// LIST paginata - GET /admin/bookings?page=&size=&sort=
export const fetchAdminBookings = async ({ page = 0, size = 10, sort = "startTime" } = {}) => {
  try {
    const { data } = await http.get(BOOKING_ENDPOINTS_ADMIN.BASE, { params: { page, size, sort } });
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Impossibile recuperare le prenotazioni (admin)."));
  }
};

// BY ID - GET /admin/bookings/{id}
export const fetchAdminBookingById = async id => {
  try {
    const { data } = await http.get(BOOKING_ENDPOINTS_ADMIN.BY_ID(id));
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Impossibile recuperare il dettaglio prenotazione (admin)."));
  }
};

// BY EMAIL - GET /admin/bookings/by-email?email=...
export const fetchAdminBookingsByEmail = async email => {
  try {
    const { data } = await http.get(BOOKING_ENDPOINTS_ADMIN.BY_EMAIL(email));
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Impossibile recuperare prenotazioni per email (admin)."));
  }
};

// AGENDA DAY - GET /admin/bookings/day?date=YYYY-MM-DD
export const fetchAdminBookingsDay = async date => {
  try {
    const { data } = await http.get(BOOKING_ENDPOINTS_ADMIN.DAY, { params: { date } });
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Impossibile recuperare le prenotazioni del giorno (admin)."));
  }
};

// AGENDA RANGE - GET /admin/bookings/range?from=&to=
export const fetchAdminBookingsRange = async (from, to) => {
  try {
    const { data } = await http.get(BOOKING_ENDPOINTS_ADMIN.RANGE, { params: { from, to } });
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Impossibile recuperare le prenotazioni nell’intervallo (admin)."));
  }
};

export const createAdminBooking = async payload => {
  try {
    const { data } = await http.post(BOOKING_ENDPOINTS_ADMIN.BASE, payload);
    return data;
  } catch (error) {
    throw new Error(error?.normalized?.message || "Errore creazione appuntamento (admin).");
  }
};

// PATCH STATUS - PATCH /admin/bookings/{id}/status?status=
export const patchAdminBookingStatus = async (id, status) => {
  try {
    const { data } = await http.patch(BOOKING_ENDPOINTS_ADMIN.STATUS(id), null, { params: { status } });
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Errore aggiornamento stato prenotazione (admin)."));
  }
};

// UPDATE (ADMIN) - PUT /admin/bookings/{id}
export const updateAdminBooking = async (id, payload) => {
  try {
    const { data } = await http.put(BOOKING_ENDPOINTS_ADMIN.BY_ID(id), payload);
    return data;
  } catch (error) {
    throw new Error(getErrMsg(error, "Errore aggiornamento prenotazione (admin)."));
  }
};

// DELETE (ADMIN) - DELETE /admin/bookings/{id}
export const deleteAdminBooking = async id => {
  try {
    await http.delete(BOOKING_ENDPOINTS_ADMIN.BY_ID(id));
    return true;
  } catch (error) {
    throw new Error(getErrMsg(error, "Errore eliminazione prenotazione (admin)."));
  }
};
