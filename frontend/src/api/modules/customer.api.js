import http from "../httpClient";

/**
 * GET /admin/customers/search?q={query}
 * Returns up to 10 customers matching name / phone / email.
 *
 * @param {string} q
 * @returns {Promise<Array<{customerId: string, fullName: string, phone?: string, email?: string}>>}
 */
export const searchCustomers = async q => {
  const { data } = await http.get("/admin/customers/search", { params: { q } });
  return Array.isArray(data) ? data : [];
};

/**
 * GET /admin/customers/{id}/summary
 *
 * @param {string} customerId - UUID string
 * @returns {Promise<any>}
 */
export const getCustomerSummary = async customerId => {
  const { data } = await http.get(`/admin/customers/${customerId}/summary`);
  return data;
};
