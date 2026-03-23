import { useEffect, useState } from "react";

/**
 * Ritorna { days, hours, minutes, seconds, expired }
 * Aggiorna ogni secondo. Pulisce l'interval su unmount.
 */
export function useCountdown(endDateString) {
  const calcRemaining = () => {
    if (!endDateString) return null;
    const end = new Date(endDateString);
    end.setHours(23, 59, 59, 999);
    const diff = end - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { days, hours, minutes, seconds, expired: false };
  };

  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    if (!endDateString) return;
    const id = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(id);
  }, [endDateString]);

  return remaining;
}
