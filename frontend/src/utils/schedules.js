// src/utils/schedule.js
import { setHours, setMinutes, addMinutes, format } from "date-fns";

export function generateTimeSlots(date, { open = "09:00", close = "19:00", durationMin = 30, breaks = [] } = {}) {
  const [oH, oM] = open.split(":").map(Number);
  const [cH, cM] = close.split(":").map(Number);

  let cursor = setMinutes(setHours(date, oH), oM);
  const end = setMinutes(setHours(date, cH), cM);

  const slots = [];
  while (cursor < end) {
    const startStr = format(cursor, "HH:mm");
    const endCandidate = addMinutes(cursor, durationMin);
    const endStr = format(endCandidate, "HH:mm");

    const overlapsBreak = breaks.some(([bStart, bEnd]) => {
      return !(endStr <= bStart || startStr >= bEnd);
    });

    if (!overlapsBreak && endCandidate <= end) {
      slots.push({ start: startStr, end: endStr });
    }
    cursor = addMinutes(cursor, durationMin);
  }
  return slots;
}
