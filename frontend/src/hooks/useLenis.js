import Lenis from "lenis";
import { useEffect } from "react";
import { useAnimationFrame } from "framer-motion";

let lenisInstance = null;
export const getLenis = () => lenisInstance;

export default function useLenis() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      smoothTouch: false,
      duration: 0.9,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 0.5,
      normalizeWheel: true,
      gestureOrientation: "vertical",
    });

    lenisInstance = lenis;
    window.__lenis = lenis;

    const stopIfInsidePrevent = e => {
      if (e.target?.closest?.("[data-lenis-prevent]")) e.stopPropagation();
    };
    window.addEventListener("wheel", stopIfInsidePrevent, { capture: true, passive: false });
    window.addEventListener("touchmove", stopIfInsidePrevent, { capture: true, passive: false });

    const refresh = () => {
      lenis.resize();
      requestAnimationFrame(() => lenis.resize());
    };
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);

    document.fonts?.ready?.then?.(refresh);
    window.addEventListener("load", refresh);
    window.addEventListener("resize", refresh);
    requestAnimationFrame(refresh);

    return () => {
      window.removeEventListener("wheel", stopIfInsidePrevent, true);
      window.removeEventListener("touchmove", stopIfInsidePrevent, true);
      window.removeEventListener("load", refresh);
      window.removeEventListener("resize", refresh);
      ro.disconnect();
      lenis.destroy();
      lenisInstance = null;
      delete window.__lenis;
    };
  }, []);

  useAnimationFrame(time => {
    lenisInstance?.raf(time);
  });
}
