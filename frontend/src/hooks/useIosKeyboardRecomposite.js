import { useEffect } from "react";

/**
 * Heals the Chrome-for-iOS (CriOS) "white band": when the virtual keyboard
 * opens/closes, Chrome iOS fails to recomposite a position:fixed panel, leaving
 * a gap that only clears when the user scrolls inside the panel. Safari iOS
 * reconciles natively (the golden baseline) → STRICT no-op there.
 *
 * NEVER touches the panel's box geometry (top/right/bottom/left/width/height/
 * transform) — mutating it collapses/clips the top+bottom side-panel. We only
 * move the panel's own overflow scroller:
 *
 *   1. Immediate: keep the scroller a hair OFF the exact top (scrollTop ≥ 1).
 *      The band only shows at the desynced top; off-top is the healed state.
 *   2. Debounced ~180ms after the visualViewport settles (fires for keyboard
 *      OPEN and keyboard CLOSE): a two-frame micro-scroll (jump ±1px on frame A,
 *      settle on frame B). Two SEPARATE paints force WebKit to recomposite — a
 *      same-frame net-zero round-trip gets coalesced and paints nothing, which
 *      is why the previous kick was too weak. It ends off-top so the heal is
 *      never undone by returning to the desynced position.
 *
 * Bounded to ~1px (rests at the current position, or 1 if at the top) → no
 * drift, no fight with iOS scroll-into-view. Worst case: a residual cosmetic
 * band — the panel stays FULL height and scrollable, never resized.
 *
 * @param {React.RefObject<HTMLElement>} scrollRef the panel's overflow scroller
 * @param {boolean} enabled                        false → detach (panel closed)
 */
const IS_CRIOS = typeof navigator !== "undefined" && /CriOS\//.test(navigator.userAgent);
const SETTLE_MS = 180; // "the viewport has stopped changing"
const OFF_TOP = 1; // rest this many px off the desynced top (tunable)

export default function useIosKeyboardRecomposite(scrollRef, enabled) {
  useEffect(() => {
    if (!enabled || !IS_CRIOS) return;
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    let raf = 0;
    let bounceRaf = 0;
    let timer = 0;

    // Immediate, cheap: nudge off the exact top (a 0→1 write is itself a painted
    // delta, so it also recomposites). No-op once already scrolled down.
    const nudgeOffTop = () => {
      raf = 0;
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return; // not scrollable → nothing to recomposite
      if (el.scrollTop < OFF_TOP) el.scrollTop = OFF_TOP;
    };

    // Authoritative: once the viewport settles, force a recomposite at the FINAL
    // geometry with two paints across frames, ending off-top.
    const settleBounce = () => {
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      const rest = Math.min(Math.max(el.scrollTop, OFF_TOP), max); // never the exact top
      const bump = rest < max ? rest + 1 : rest - 1; // a real neighbour to paint first
      el.scrollTop = bump; // frame A
      if (bounceRaf) cancelAnimationFrame(bounceRaf);
      bounceRaf = requestAnimationFrame(() => {
        const el2 = scrollRef.current;
        if (el2) el2.scrollTop = rest; // frame B: delta vs A → recomposite, rests off-top
      });
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(nudgeOffTop);
      clearTimeout(timer);
      timer = setTimeout(settleBounce, SETTLE_MS);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (raf) cancelAnimationFrame(raf);
      if (bounceRaf) cancelAnimationFrame(bounceRaf);
      clearTimeout(timer);
    };
  }, [enabled, scrollRef]);
}
