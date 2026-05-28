import { useEffect } from "react";

/**
 * Heals the Chrome-for-iOS (CriOS) "white band": when the virtual keyboard
 * opens/closes, Chrome iOS fails to recomposite a position:fixed panel, leaving
 * a gap that only clears when the user scrolls inside the panel. Safari iOS
 * reconciles natively (the golden baseline) → this is a STRICT no-op there.
 *
 * We never touch the panel's geometry (top/right/bottom/left/width/height/
 * transform). Mutating geometry on a top+bottom side-panel collapses/clips it
 * (the reverted approaches). Instead, on every visualViewport resize/scroll
 * (keyboard open AND close) we reproduce the manual-scroll heal with a net-zero
 * 1px nudge of the panel's own overflow scroller, rAF-coalesced.
 *
 * Worst case (a Chrome build the nudge can't fully heal): a residual cosmetic
 * band — the panel stays FULL height and scrollable, never resized.
 *
 * @param {React.RefObject<HTMLElement>} scrollRef the panel's overflow scroller
 * @param {boolean} enabled                        false → detach (panel closed)
 */
const IS_CRIOS = typeof navigator !== "undefined" && /CriOS\//.test(navigator.userAgent);

export default function useIosKeyboardRecomposite(scrollRef, enabled) {
  useEffect(() => {
    if (!enabled || !IS_CRIOS) return;
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    let raf = 0;

    const kick = () => {
      raf = 0;
      const el = scrollRef.current;
      if (!el) return;
      const top = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return; // not scrollable → nothing to recomposite
      const delta = top >= max ? -1 : 1;
      el.scrollTop = top + delta; // a real 1px move forces the recomposite…
      el.scrollTop = top; // …then restore exactly (net zero, no visible jump)
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(kick);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, scrollRef]);
}
