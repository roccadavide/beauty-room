import http from "../httpClient";

export const joinWaitlist = (payload) =>
  http.post("/waitlist", payload).then(r => r.data);

export const resolveWaitlistToken = (token) =>
  http.get(`/waitlist/token/${token}`).then(r => r.data);
