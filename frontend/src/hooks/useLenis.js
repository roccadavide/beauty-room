import Lenis from "lenis";
import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let lenisInstance = null;
export const getLenis = () => lenisInstance;

export default function useLenis() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      // lerp al posto di duration: smoothing agganciato all'input,
      // niente "coda" che rincorre → sensazione netta e pulita.
      lerp: 0.1,
      // niente più dimezzamento: lo scroll risponde 1:1 alla rotella.
      wheelMultiplier: 1,
      // touchMultiplier alto = trascinamento mobile pieno e diretto.
      touchMultiplier: 1.6,
      normalizeWheel: true,
      gestureOrientation: "vertical",
    });

    lenisInstance = lenis;
    window.__lenis = lenis;

    /* ── Integrazione ufficiale Lenis ↔ GSAP ScrollTrigger ──
       - ogni scroll di Lenis aggiorna ScrollTrigger
       - gsap.ticker (unico loop rAF) pilota Lenis: niente più
         useAnimationFrame di framer, una sola sorgente di verità. */
    lenis.on("scroll", ScrollTrigger.update);

    const tick = time => lenis.raf(time * 1000); // gsap.ticker → secondi; Lenis → ms
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const stopIfInsidePrevent = e => {
      if (e.target?.closest?.("[data-lenis-prevent]")) e.stopPropagation();
    };
    window.addEventListener("wheel", stopIfInsidePrevent, { capture: true, passive: false });
    window.addEventListener("touchmove", stopIfInsidePrevent, { capture: true, passive: false });

    const refresh = () => {
      lenis.resize();
      ScrollTrigger.refresh();
    };
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);

    document.fonts?.ready?.then?.(refresh);
    window.addEventListener("load", refresh);

    // Publish --app-dvh = visualViewport.height in px.
    // Workaround for an iOS/iPad Safari bug where dvh doesn't recompute
    // after a body scroll-lock; CSS uses this as a fallback inside min().
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const updateAppDvh = () => {
      const h = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-dvh", `${h}px`);
    };
    updateAppDvh();
    vv?.addEventListener("resize", updateAppDvh);
    vv?.addEventListener("scroll", updateAppDvh);
    window.addEventListener("orientationchange", updateAppDvh);

    return () => {
      window.removeEventListener("wheel", stopIfInsidePrevent, true);
      window.removeEventListener("touchmove", stopIfInsidePrevent, true);
      window.removeEventListener("load", refresh);
      vv?.removeEventListener("resize", updateAppDvh);
      vv?.removeEventListener("scroll", updateAppDvh);
      window.removeEventListener("orientationchange", updateAppDvh);
      document.documentElement.style.removeProperty("--app-dvh");
      gsap.ticker.remove(tick);
      ro.disconnect();
      lenis.destroy();
      lenisInstance = null;
      delete window.__lenis;
    };
  }, []);
}
