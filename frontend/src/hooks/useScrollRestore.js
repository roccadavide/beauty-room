import { useEffect } from "react";

/**
 * useScrollRestore – salva l'ID dell'elemento cliccato e ci scrolla al ritorno.
 */
const useScrollRestore = key => {
  const storageKey = `scroll_restore_${key}`;

  /** Salva l'id dell'elemento da ripristinare */
  const save = itemId => {
    if (itemId != null) {
      sessionStorage.setItem(storageKey, String(itemId));
    }
  };

  useEffect(() => {
    const savedId = sessionStorage.getItem(storageKey);
    if (!savedId) return;
    sessionStorage.removeItem(storageKey);

    const GIVE_UP_AT = performance.now() + 4000; // max 4 s di tentativi
    const PIN_DURATION = 600; // ms di pinning post-restore (assorbe layout-shift)
    let rafId;
    let restoredAt = null;

    const scrollToEl = el => {
      const rect = el.getBoundingClientRect();
      const lenis = window.__lenis;
      const currentScroll = lenis ? lenis.scroll : window.scrollY;

      // Posizioniamo la card al ~30 % dall'alto del viewport
      const targetY = Math.max(0, currentScroll + rect.top - window.innerHeight * 0.3);

      if (lenis) {
        lenis.scrollTo(targetY, { immediate: true });
      } else {
        window.scrollTo({ top: targetY, behavior: "instant" });
      }
    };

    const tick = () => {
      const now = performance.now();
      const el = document.querySelector(`[data-scroll-id="${CSS.escape(savedId)}"]`);

      // ── Fase 2: già restorato → pinna per PIN_DURATION ──
      if (restoredAt !== null) {
        if (el) scrollToEl(el);
        if (now - restoredAt < PIN_DURATION) {
          rafId = requestAnimationFrame(tick);
        }
        return;
      }

      // ── Timeout di sicurezza ──
      if (now > GIVE_UP_AT) return;

      // ── Fase 1: aspetta che l'elemento esista nel DOM ──
      if (el) {
        scrollToEl(el);
        restoredAt = now;
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [storageKey]);

  return { save };
};

export default useScrollRestore;
