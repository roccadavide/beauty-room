import http from "../httpClient";
import { REPORT_ENDPOINTS } from "../endpoints";

export const getReport = async (from, to) => {
  const { data } = await http.get(REPORT_ENDPOINTS.REPORT, { params: { from, to } });
  return data;
};

