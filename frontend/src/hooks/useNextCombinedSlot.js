import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const pad2 = n => String(n).padStart(2, "0");
const toLocalISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Sibling di useNextSlot per il flusso carrello/multi-servizio: cerca il prossimo
// slot dimensionato sulla DURATA COMBINATA (somma dei servizi) anziché su un singolo
// serviceId. Stessa shape di ritorno di useNextSlot — NextSlotBanner è generico.
//
// filters = { daysOfWeek?: string[], windowStart?: string|null, windowEnd?: string|null }
// (default {}). Sono SOLO restringenti e vengono aggiunti all'URL solo se presenti:
// con filters vuoti la richiesta è identica a prima (garanzia di non-regressione).
export function useNextCombinedSlot(durationMinutes, filters = {}) {
  const { daysOfWeek, windowStart, windowEnd } = filters;
  // CSV di nomi enum (MONDAY,TUESDAY) — primitivo stabile per le deps di findNext.
  const daysKey = Array.isArray(daysOfWeek) ? daysOfWeek.join(",") : "";

  const [nextSlot, setNextSlot] = useState(null);   // { date, startTime, endTime }
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [fromDate, setFromDate] = useState(null);   // giorno da cui ripartire
  const [fromTime, setFromTime] = useState(null);   // orario da cui ripartire (stesso giorno)

  const findNext = useCallback(async (searchFromDate, searchFromTime) => {
    if (!durationMinutes) return;
    setLoading(true);
    setNotFound(false);
    try {
      const from = searchFromDate ?? toLocalISODate(new Date());
      let url = `${API_BASE}/api/public/slots/next-combined?durationMinutes=${durationMinutes}&fromDate=${from}`;
      if (searchFromTime) url += `&fromTime=${searchFromTime}`;
      if (daysKey) url += `&daysOfWeek=${daysKey}`;
      if (windowStart) url += `&windowStart=${windowStart}`;
      if (windowEnd) url += `&windowEnd=${windowEnd}`;
      const res = await fetch(url);
      if (res.status === 404) {
        setNextSlot(null);
        setNotFound(true);
        return;
      }
      const slot = await res.json();
      setNextSlot(slot);
      // "prossimo ancora" riparte dallo stesso giorno dopo l'orario di fine slot
      setFromDate(slot.date);
      setFromTime(slot.endTime || null);
    } catch {
      setNextSlot(null);
    } finally {
      setLoading(false);
    }
  }, [durationMinutes, daysKey, windowStart, windowEnd]);

  const findNextAgain = useCallback(() => {
    if (fromDate) findNext(fromDate, fromTime);
  }, [fromDate, fromTime, findNext]);

  return { nextSlot, loading, notFound, findNext, findNextAgain, hasMore: !!fromDate };
}
