import { BOOKING_ENDPOINTS } from "../endpoints";
import http from "../httpClient";

// ---------------------------------- BOOKINGS ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchBookings = async () => {
  try {
    const { data } = await http.get(BOOKING_ENDPOINTS.BASE);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le prenotazioni. Riprova più tardi.";
    throw new Error(message);
  }
};

// -------------------------- GET BY EMAIL --------------------------
export const fetchMyBookings = async email => {
  try {
    const { data } = await http.get(BOOKING_ENDPOINTS.BY_EMAIL(email));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le prenotazioni dell'utente.";
    throw new Error(message);
  }
};

// -------------------------- POST --------------------------
export const createBooking = async payload => {
  try {
    const { data } = await http.post(BOOKING_ENDPOINTS.BASE, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della prenotazione.";
    throw new Error(message);
  }
};

// -------------------------- DELETE --------------------------
export const deleteBooking = async bookingId => {
  try {
    await http.delete(BOOKING_ENDPOINTS.BY_ID(bookingId));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'eliminazione della prenotazione.";
    throw new Error(message);
  }
};
