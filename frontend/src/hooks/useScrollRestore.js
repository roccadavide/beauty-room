import { useEffect } from "react";

const useScrollRestore = key => {
  const storageKey = `scroll_restore_${key}`;

  // Chiamata esplicita prima di navigate() — sincrona, prima che
  // App.jsx resetti Lenis a zero
  const save = () => {
    const lenis = window.__lenis;
    const y = lenis ? lenis.scroll : window.scrollY;
    if (y > 10) {
      sessionStorage.setItem(storageKey, String(y));
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;

    const targetY = parseFloat(saved);
    if (isNaN(targetY) || targetY <= 0) {
      sessionStorage.removeItem(storageKey);
      return;
    }

    sessionStorage.removeItem(storageKey);

    const pin = () => {
      const lenis = window.__lenis;
      if (lenis) {
        lenis.scrollTo(targetY, { immediate: true });
      } else {
        window.scrollTo({ top: targetY, behavior: "instant" });
      }
    };

    // Pinna la posizione ogni frame per i primi ~350ms
    // (durata animazione entrata ~0.9s, a 350ms è ancora quasi opaco)
    const start = performance.now();
    let rafId;

    const loop = now => {
      pin();
      if (now - start < 350) {
        rafId = requestAnimationFrame(loop);
      }
    };

    rafId = requestAnimationFrame(loop);

    // Fallback finale per dati async che cambiano l'altezza della pagina
    const t = setTimeout(pin, 750);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { save };
};

export default useScrollRestore;
