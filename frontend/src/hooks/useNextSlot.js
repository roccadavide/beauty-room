import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const pad2 = n => String(n).padStart(2, "0");
const toLocalISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function useNextSlot(serviceId) {
  const [nextSlot, setNextSlot] = useState(null);   // { date, startTime, endTime }
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [fromDate, setFromDate] = useState(null);   // giorno da cui ripartire
  const [fromTime, setFromTime] = useState(null);   // orario da cui ripartire (stesso giorno)

  const findNext = useCallback(async (searchFromDate, searchFromTime) => {
    if (!serviceId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const from = searchFromDate ?? toLocalISODate(new Date());
      let url = `${API_BASE}/api/public/slots/next?serviceId=${serviceId}&fromDate=${from}`;
      if (searchFromTime) url += `&fromTime=${searchFromTime}`;
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
  }, [serviceId]);

  const findNextAgain = useCallback(() => {
    if (fromDate) findNext(fromDate, fromTime);
  }, [fromDate, fromTime, findNext]);

  return { nextSlot, loading, notFound, findNext, findNextAgain, hasMore: !!fromDate };
}
