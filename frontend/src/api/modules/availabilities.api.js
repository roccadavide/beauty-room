import { AVAILABILITY_ENDPOINTS } from "../endpoints";
import http from "../httpClient";

// ---------------------------------- AVAILABILITIES ----------------------------------

// -------------------------- GET --------------------------
export const fetchAvailabilities = async (serviceId, date) => {
  try {
    const { data } = await http.get(AVAILABILITY_ENDPOINTS.SERVICE_DAY(serviceId, date));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le disponibilità. Riprova più tardi.";
    throw new Error(message);
  }
};

// Combined availability for the multi-service (cart) flow. Same contract as
// fetchAvailabilities: returns AvailabilityResponseDTO { serviceId, date, stepMinutes,
// slots: [{ start, end, available }] } — ALL slots flagged, empty ONLY when truly closed.
export const fetchCombinedAvailabilities = async (date, durationMinutes) => {
  try {
    const { data } = await http.get(AVAILABILITY_ENDPOINTS.COMBINED_SLOTS, {
      params: { date, durationMinutes },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le disponibilità. Riprova più tardi.";
    throw new Error(message);
  }
};
