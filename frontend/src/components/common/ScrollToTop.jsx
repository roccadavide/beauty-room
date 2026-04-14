import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Mappa pathname → chiave sessionStorage usata da useScrollRestore
// Aggiorna qui se aggiungi altre pagine con scroll restore
const RESTORE_KEYS = {
  "/trattamenti": "scroll_restore_service-page",
  "/prodotti":    "scroll_restore_products-page",
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Se questa pagina ha un restore in attesa, lascia fare a useScrollRestore
    const restoreKey = RESTORE_KEYS[pathname];
    if (restoreKey && sessionStorage.getItem(restoreKey)) return;

    const timeout = setTimeout(() => {
      const lenis = window.__lenis;
      if (lenis) {
        lenis.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
