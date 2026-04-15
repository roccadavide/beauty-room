import { useEffect } from "react";

const useScrollRestore = key => {
  const storageKey = `scroll_restore_${key}`;

  const save = () => {
    const lenis = window.__lenis;
    const y = lenis ? lenis.scroll : window.scrollY;
    if (y > 10) sessionStorage.setItem(storageKey, String(y));
  };

  useEffect(() => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;

    const targetY = parseFloat(raw);
    if (isNaN(targetY) || targetY <= 0) {
      sessionStorage.removeItem(storageKey);
      return;
    }

    sessionStorage.removeItem(storageKey);

    const GIVE_UP_AT = performance.now() + 3000; // max 3s di tentativi
    const PIN_DURATION = 400; // ms di pinning post-restore
    let rafId;
    let restoredAt = null;

    const doScroll = () => {
      const lenis = window.__lenis;
      if (lenis) lenis.scrollTo(targetY, { immediate: true });
      else window.scrollTo({ top: targetY, behavior: "instant" });
    };

    const tick = () => {
      const now = performance.now();

      // Fase 2: già restorato → pinna per PIN_DURATION ms per assorbire
      // layout shift tardivi (immagini, font, contenuto async)
      if (restoredAt !== null) {
        doScroll();
        if (now - restoredAt < PIN_DURATION) {
          rafId = requestAnimationFrame(tick);
        }
        return;
      }

      // Timeout di sicurezza
      if (now > GIVE_UP_AT) return;

      // Fase 1: aspetta che la pagina sia abbastanza alta da contenere targetY
      // (30% viewport di margine per evitare di scrollare "sull'orlo")
      const needed = targetY + window.innerHeight * 0.3;
      if (document.body.scrollHeight >= needed) {
        doScroll();
        restoredAt = now;
        rafId = requestAnimationFrame(tick);
      } else {
        // Skeleton ancora visibile o fetch in corso — riprova al prossimo frame
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { save };
};

export default useScrollRestore;
