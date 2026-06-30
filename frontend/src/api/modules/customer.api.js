import http from "../httpClient";
import { CUSTOMER_ENDPOINTS } from "../endpoints";

/**
 * GET /admin/customers/search?q={query}
 * Returns up to 10 customers matching name / phone / email.
 *
 * @param {string} q
 * @returns {Promise<Array<{customerId: string, fullName: string, phone?: string, email?: string}>>}
 */
export const searchCustomers = async q => {
  const { data } = await http.get(CUSTOMER_ENDPOINTS.SEARCH, { params: { q } });
  return Array.isArray(data) ? data : [];
};

/**
 * POST /admin/customers
 * Inline customer creation (find-or-create by phone on the backend).
 *
 * @param {{fullName: string, phone: string, email?: string}} payload
 * @returns {Promise<{customerId: string, fullName: string, phone?: string, email?: string}>}
 */
export const createCustomer = async payload => {
  const { data } = await http.post(CUSTOMER_ENDPOINTS.CREATE, payload);
  return data;
};

/**
 * GET /admin/customers/{id}/summary
 *
 * @param {string} customerId - UUID string
 * @returns {Promise<any>}
 */
export const getCustomerSummary = async customerId => {
  const { data } = await http.get(CUSTOMER_ENDPOINTS.SUMMARY(customerId));
  return data;
};

/**
 * GET /admin/customers/{id}/bookings?pastLimit={pastLimit}
 * Rich, agenda-shaped booking history split into upcoming (future, full set) and
 * past (most-recent `pastLimit`). Each entry is a full AdminBookingCardDTO, so an
 * upcoming row can be handed straight to NewAppointmentDrawer's edit flow.
 * "Load more" re-fetches with a larger pastLimit and replaces (fine at salon volume).
 *
 * @param {string} customerId - UUID string
 * @param {number} [pastLimit=20]
 * @returns {Promise<{upcoming: any[], past: any[], pastTotal: number}>}
 */
export const fetchCustomerBookings = async (customerId, pastLimit = 20) => {
  const { data } = await http.get(CUSTOMER_ENDPOINTS.BOOKINGS(customerId), { params: { pastLimit } });
  return {
    upcoming: Array.isArray(data?.upcoming) ? data.upcoming : [],
    past: Array.isArray(data?.past) ? data.past : [],
    pastTotal: data?.pastTotal ?? 0,
  };
};

/**
 * GET /admin/customers/insights
 * Customers-workspace overview: headline counts + top-client rankings + win-back.
 *
 * @returns {Promise<{
 *   totalCustomers: number, trustedCustomersCount: number, activePackagesCount: number,
 *   outstandingTotal: number,
 *   topByCompletedAppointments: Array<{customerId: string|null, name: string, phone: string, count: number}>,
 *   topByPackages: Array<{customerId: string|null, name: string, phone: string, count: number}>,
 *   topBySpend: Array<{customerId: string|null, name: string, phone: string, revenue: number, visits: number}>,
 *   winBack: Array<{customerId: string, name: string, phone: string, lastVisit: string, daysSince: number}>
 * }>}
 */
export const fetchCustomerInsights = async () => {
  const { data } = await http.get(CUSTOMER_ENDPOINTS.INSIGHTS);
  return data;
};

export const updateCustomerNotes = async (customerId, notes) => {
  await http.patch(CUSTOMER_ENDPOINTS.NOTES(customerId), { notes });
};

export const updateCustomer = async (customerId, payload) => {
  const { data } = await http.patch(CUSTOMER_ENDPOINTS.BASE(customerId), payload);
  return data;
};

export const getActivePackages = async customerId => {
  const { data } = await http.get(CUSTOMER_ENDPOINTS.ACTIVE_PACKAGES(customerId));
  return Array.isArray(data) ? data : [];
};

export const deleteCustomer = async customerId => {
  await http.delete(CUSTOMER_ENDPOINTS.BASE(customerId));
};
