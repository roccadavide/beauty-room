import Lenis from "lenis";
import { useEffect } from "react";

export default function useLenis() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      smoothTouch: false,
    });

    lenis.on("scroll", e => {
      console.log("scrolling:", e);
    });

    return () => lenis.destroy();
  }, []);
}
