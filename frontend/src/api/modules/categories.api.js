import { CATEGORY_ENDPOINTS } from "../endpoints";
import http from "../httpClient";

// ---------------------------------- CATEGORIES ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchCategories = async () => {
  try {
    const { data } = await http.get(CATEGORY_ENDPOINTS.BASE);
    return data.content || data || [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le categorie. Riprova più tardi.";
    throw new Error(message);
  }
};
