import { useCallback, useEffect, useMemo, useState } from "react";
import { BOOKING_MAX_ADVANCE_DAYS } from "../utils/constants";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// L'endpoint /day-status rifiuta span > 62 giorni: spezziamo la finestra in
// chunk consecutivi da al massimo 60 giorni (margine di sicurezza).
const CHUNK_DAYS = 60;

const pad2 = n => String(n).padStart(2, "0");
const toISO = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Giorni aperti ma completamente pieni per una data durata, sull'intera finestra
 * prenotabile [oggi, oggi + BOOKING_MAX_ADVANCE_DAYS]. Degrada a nessun giorno se
 * la durata non è ancora nota o se una fetch fallisce (mai throw, mai blocca il calendario).
 */
export function useFullDays(durationMinutes) {
  const [fullDates, setFullDates] = useState([]);

  useEffect(() => {
    if (!(typeof durationMinutes === "number" && durationMinutes > 0)) {
      setFullDates([]);
      return;
    }

    let cancelled = false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Chunk [from, to] consecutivi, span ≤ CHUNK_DAYS, che coprono tutta la finestra senza buchi.
    const chunks = [];
    for (let offset = 0; offset <= BOOKING_MAX_ADVANCE_DAYS; offset += CHUNK_DAYS + 1) {
      const from = new Date(today);
      from.setDate(today.getDate() + offset);
      const to = new Date(today);
      to.setDate(today.getDate() + Math.min(offset + CHUNK_DAYS, BOOKING_MAX_ADVANCE_DAYS));
      chunks.push([toISO(from), toISO(to)]);
    }

    Promise.all(
      chunks.map(([fromDate, toDate]) =>
        fetch(`${API_BASE}/api/public/availability/day-status?fromDate=${fromDate}&toDate=${toDate}&durationMinutes=${durationMinutes}`)
          .then(r => (r.ok ? r.json() : null))
          .then(data => (data && Array.isArray(data.fullDates) ? data.fullDates : []))
          .catch(() => []),
      ),
    ).then(results => {
      if (cancelled) return;
      const union = new Set();
      results.forEach(arr => arr.forEach(iso => union.add(iso)));
      setFullDates(Array.from(union));
    });

    return () => {
      cancelled = true;
    };
  }, [durationMinutes]);

  const fullSet = useMemo(() => new Set(fullDates), [fullDates]);
  const isFull = useCallback(iso => fullSet.has(iso), [fullSet]);

  return { fullDates, isFull };
}
