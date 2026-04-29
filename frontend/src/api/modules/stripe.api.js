import http from "../httpClient";
import { STRIPE_ENDPOINTS, PUBLIC_AVAIL_ENDPOINTS } from "../endpoints";

// ---------------------------------- STRIPE ----------------------------------

// --------------------------- CHECKOUT ORDER USERS ---------------------------
export const createCheckoutSession = async orderData => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT, orderData);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- CHECKOUT ORDER GUESTS ---------------------------
export const createCheckoutSessionGuest = async orderData => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_GUEST, orderData);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- ORDER SUMMARY ---------------------------
export const fetchOrderSummary = async sessionId => {
  const { data } = await http.get(`${STRIPE_ENDPOINTS.ORDER_SUMMARY}`, {
    params: { session_id: sessionId },
  });
  return data;
};

// --------------------------- CHECKOUT BOOKING ADMIN ---------------------------
export const createBookingCheckoutSessionAuth = async payload => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_BOOKING, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- CHECKOUT BOOKING GUESTS ---------------------------
export const createBookingCheckoutSessionGuest = async payload => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_BOOKING_GUEST, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- CHECKOUT BOOKING PAY IN STORE (Cliente di Fiducia) ---------------------------
export const createBookingPayInStore = async payload => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_BOOKING_PAY_IN_STORE, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la prenotazione. Riprova più tardi.";
    throw new Error(message);
  }
};

// --------------------------- CHECKOUT BOOKING MULTI (public) ---------------------------
export const createMultiServiceBookingCheckout = async payload => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_BOOKING_MULTI, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- AVAILABLE SLOTS (public) ---------------------------
export const fetchAvailableSlots = async (date, durationMinutes) => {
  const { data } = await http.get(PUBLIC_AVAIL_ENDPOINTS.AVAILABLE_SLOTS, {
    params: { date, durationMinutes },
  });
  return data; // List<String> "HH:mm"
};

// --------------------------- BOOKING SUMMARY ---------------------------
export const fetchBookingSummary = async sessionId => {
  const { data } = await http.get(STRIPE_ENDPOINTS.BOOKING_SUMMARY, {
    params: { session_id: sessionId },
  });
  return data;
};
