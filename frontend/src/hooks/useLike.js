import { useCallback, useState } from "react";
import { postLike, deleteLike } from "../api/modules/likes.api";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h — allineato al rate limit backend

/**
 * Hook per gestire il like di un'entità con optimistic UI e rate limit locale.
 *
 * @param {string} entityType  - "SERVICE" | "PRODUCT" | "RESULT"
 * @param {string} entityId    - UUID dell'entità
 * @param {number} initialCount - contatore iniziale (dal server, default 0)
 */
export function useLike(entityType, entityId, initialCount = 0) {
  const key = `br_like_${entityType}_${entityId}`;

  const isAlreadyLiked = () => {
    try {
      const ts = localStorage.getItem(key);
      return ts && Date.now() - Number(ts) < TTL_MS;
    } catch {
      return false;
    }
  };

  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(isAlreadyLiked);
  const [burst, setBurst] = useState(false);

  // Hint pulse: visibile solo se l'utente non ha mai messo like a nulla
  const [showHint] = useState(() => {
    try {
      return !localStorage.getItem("br_like_seen");
    } catch {
      return false;
    }
  });

  const triggerLike = useCallback(async () => {
    setBurst(!liked); // burst solo quando si mette like, non quando si toglie
    if (!liked) {
      setTimeout(() => setBurst(false), 900);
    }

    if (liked) {
      // UNLIKE: ottimistico
      setCount(c => Math.max(0, c - 1));
      setLiked(false);
      try { localStorage.removeItem(key); } catch {}
      try {
        const serverCount = await deleteLike(entityType, entityId);
        setCount(serverCount);
      } catch {
        // rollback ottimistico in caso di errore
        setCount(c => c + 1);
        setLiked(true);
        try { localStorage.setItem(key, String(Date.now())); } catch {}
      }
    } else {
      // LIKE: comportamento esistente
      setCount(c => c + 1);
      setLiked(true);
      try {
        localStorage.setItem(key, String(Date.now()));
        localStorage.setItem("br_like_seen", "1");
      } catch {}
      try {
        const serverCount = await postLike(entityType, entityId);
        setCount(serverCount);
      } catch {
        setCount(c => Math.max(0, c - 1));
        setLiked(false);
        try { localStorage.removeItem(key); } catch {}
      }
    }
  }, [entityType, entityId, key, liked]);

  return { count, liked, burst, triggerLike, showHint };
}
