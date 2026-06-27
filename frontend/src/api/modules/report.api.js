import http from "../httpClient";
import { REPORT_ENDPOINTS } from "../endpoints";

export const getReport = async (from, to, compare = "prevPeriod") => {
  const { data } = await http.get(REPORT_ENDPOINTS.REPORT, { params: { from, to, compare } });
  return data;
};

