import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Salva la posizione di scroll in sessionStorage al cleanup,
 * la ripristina al mount dopo che ScrollToTop e Lenis si sono stabilizzati.
 *
 * @param {string} key - chiave univoca per questa pagina (es. "service-page")
 */
const useScrollRestore = (key) => {
  const location = useLocation();
  const storageKey = `scroll_restore_${key}`;

  // ── RIPRISTINA al mount ──────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;

    const targetY = parseFloat(saved);
    if (isNaN(targetY) || targetY <= 0) return;

    // Pulisci subito: se l'utente fa F5 o naviga direttamente non vogliamo
    // restaurare una posizione stantia
    sessionStorage.removeItem(storageKey);

    // Aspetta che:
    // 1. ScrollToTop abbia già portato a y=0
    // 2. Lenis sia inizializzato
    // 3. Il DOM sia renderizzato con i dati (gestito da un secondo timeout)
    const restore = () => {
      const lenis = window.__lenis;
      if (lenis) {
        lenis.scrollTo(targetY, { immediate: true });
      } else {
        window.scrollTo({ top: targetY, behavior: "instant" });
      }
    };

    // Primo tentativo dopo il paint iniziale
    const t1 = setTimeout(restore, 80);
    // Secondo tentativo dopo che i dati async potrebbero essere arrivati
    const t2 = setTimeout(restore, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SALVA allo smontaggio ────────────────────────────────────────
  useEffect(() => {
    return () => {
      const lenis = window.__lenis;
      const y = lenis ? lenis.scroll : window.scrollY;
      if (y > 10) {
        sessionStorage.setItem(storageKey, String(y));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export default useScrollRestore;
