import Lenis from "lenis";
import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let lenisInstance = null;
export const getLenis = () => lenisInstance;

// Ref-counted lock for full-page surfaces (e.g. the booking route) that scroll
// natively and must NOT fight Lenis. Lenis is stopped while ≥1 surface is mounted
// and started again only when the LAST one unmounts — so a promo→booking sequence
// (one unmounts as the next mounts) can never leave Lenis stopped, under any ordering.
let lenisLockCount = 0;
export function pushLenisLock() {
  if (lenisLockCount === 0) getLenis()?.stop();
  lenisLockCount++;
}
export function popLenisLock() {
  lenisLockCount = Math.max(0, lenisLockCount - 1);
  if (lenisLockCount === 0) getLenis()?.start();
}

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

    return () => {
      window.removeEventListener("wheel", stopIfInsidePrevent, true);
      window.removeEventListener("touchmove", stopIfInsidePrevent, true);
      window.removeEventListener("load", refresh);
      gsap.ticker.remove(tick);
      ro.disconnect();
      lenis.destroy();
      lenisInstance = null;
      delete window.__lenis;
    };
  }, []);
}
