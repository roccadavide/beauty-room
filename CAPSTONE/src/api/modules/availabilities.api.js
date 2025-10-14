import http from "./httpClient";
import { AVAILABILITY_ENDPOINTS } from "./endpoints";

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
