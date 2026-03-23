import http from "../httpClient";

export const fetchBookingSales = async (bookingId) => {
  const { data } = await http.get(`/admin/bookings/${bookingId}/sales`);
  return data;
};

export const addBookingSale = async (bookingId, dto) => {
  const { data } = await http.post(`/admin/bookings/${bookingId}/sales`, dto);
  return data;
};

export const deleteBookingSale = async (bookingId, saleId) => {
  await http.delete(`/admin/bookings/${bookingId}/sales/${saleId}`);
};
