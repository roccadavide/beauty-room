import { useCallback, useRef } from "react";

function isSlowConnection() {
  const conn = navigator?.connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  if (["slow-2g", "2g"].includes(conn.effectiveType)) return true;
  return false;
}

let activePrefetches = 0;
const MAX_CONCURRENT = 3;

export function usePrefetch(fetcher) {
  const timerRef = useRef(null);

  const onMouseEnter = useCallback(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    if (isSlowConnection()) return;
    if (activePrefetches >= MAX_CONCURRENT) return;

    timerRef.current = setTimeout(() => {
      activePrefetches++;
      fetcher()
        .catch(() => {})
        .finally(() => {
          activePrefetches--;
        });
    }, 150);
  }, [fetcher]);

  const onMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  return { onMouseEnter, onMouseLeave };
}
