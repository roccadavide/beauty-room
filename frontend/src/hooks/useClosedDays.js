import { useMemo, useState, useEffect } from 'react';

export function useClosedDays() {
  const [closedDates, setClosedDates] = useState([]);      // ["2025-08-15", ...]
  const [closedWeekdays, setClosedWeekdays] = useState([]); // ["SUNDAY", ...]

  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    fetch(`${API_BASE}/api/public/closures`)
      .then(r => r.json())
      .then(list => {
        setClosedDates(list.filter(c => c.date).map(c => c.date));
        setClosedWeekdays(list.filter(c => c.dayOfWeek).map(c => c.dayOfWeek));
      })
      .catch(() => {
        // fallback: blocca almeno la domenica
        setClosedWeekdays(['SUNDAY']);
      });
  }, []);

  // Restituisce true se la data ISO è chiusa
  const isClosed = useMemo(() => (isoDate) => {
    if (closedDates.includes(isoDate)) return true;
    const dow = new Date(isoDate + 'T12:00:00')
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();
    return closedWeekdays.includes(dow);
  }, [closedDates, closedWeekdays]);

  return { closedDates, closedWeekdays, isClosed };
}
