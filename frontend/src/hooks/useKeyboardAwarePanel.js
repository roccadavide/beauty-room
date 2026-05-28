import { useEffect } from "react";

/**
 * Keeps a top+bottom-anchored side-panel glued to the visual viewport while the
 * iOS virtual keyboard is up — but ONLY on Chrome for iOS (CriOS).
 *
 * Why CriOS-only: Safari iOS already reconciles a `position:fixed` panel when
 * the keyboard opens/closes (no artifact — it is the golden baseline). Chrome
 * iOS wraps WebKit with its own toolbar and fails to recomposite the fixed
 * panel on keyboard close, leaving a persistent "white band" at the panel's
 * bottom that only heals on a manual scroll. So this hook is a strict no-op on
 * Safari, desktop and Android — nothing is attached there.
 *
 * Mechanism: while a text input inside the panel is focused, pin the panel's
 * `top` to `visualViewport.offsetTop` and its `height` to `visualViewport.height`
 * (the rectangle NOT covered by the keyboard). We NEVER set `bottom`: on a
 * top+bottom panel `bottom = keyboardHeight` shortens it and clips content
 * (the reverted Round-3 failure). `height = vv.height` is the visible height by
 * construction, so it cannot clip and cannot leave a band; the inner scroll
 * area (`.ud-body` / `.nad-content`) simply gets less room and scrolls to the
 * focused field.
 *
 * Side-panel only: the bottom-sheet branch is left to its own existing handling.
 *
 * @param {React.RefObject<HTMLElement>} panelRef   the panel element
 * @param {boolean} enabled                          false → detach (panel closed)
 * @param {string}  sidePanelQuery                   media query that means "side panel"
 *                                                    (UnifiedDrawer: "(min-width: 768px)",
 *                                                     NAD/CLD: "(min-width: 769px)")
 */
const IS_CRIOS = typeof navigator !== "undefined" && /CriOS\//.test(navigator.userAgent);

export default function useKeyboardAwarePanel(panelRef, enabled, sidePanelQuery) {
  useEffect(() => {
    if (!enabled || !IS_CRIOS) return;
    if (typeof window === "undefined" || !window.visualViewport) return;
    const panel = panelRef.current;
    if (!panel) return;

    const vv = window.visualViewport;
    const SETTLE_EPS = 2; // px tolerance for "viewport is back to full"
    // 0 = idle, 1 = text input focused (keyboard up), 2 = closing (track until settled)
    let phase = 0;
    let raf = 0;
    let closeTimer = 0;

    const isSidePanel = () => window.matchMedia(sidePanelQuery).matches;

    const clearInline = p => {
      p.style.top = "";
      p.style.height = "";
    };

    const isTextInput = el => {
      if (!el) return false;
      if (el.tagName === "TEXTAREA") return true;
      if (el.tagName === "INPUT") {
        const t = (el.type || "text").toLowerCase();
        return !["button", "submit", "reset", "checkbox", "radio", "file", "image", "range", "color"].includes(t);
      }
      return el.isContentEditable === true;
    };

    const apply = () => {
      raf = 0;
      const p = panelRef.current;
      if (!p) return;
      // Bottom-sheet branch is never managed here.
      if (!isSidePanel()) {
        clearInline(p);
        return;
      }
      const vh = vv.height;
      const vt = vv.offsetTop;
      const settledFull = window.innerHeight - vh <= SETTLE_EPS && vt <= SETTLE_EPS;
      if ((phase === 1 || phase === 2) && !settledFull) {
        // Pin to the visible rectangle. Inline top+height over-constrain the CSS
        // `bottom: 0`, so the browser uses top+height and ignores bottom — no clip.
        p.style.top = `${vt}px`;
        p.style.height = `${vh}px`;
      } else {
        // Idle, or the viewport has settled back to full after a close → release
        // so the CSS top:0/bottom:0 resumes.
        clearInline(p);
        if (phase === 2) phase = 0;
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };

    const onFocusIn = e => {
      if (!panel.contains(e.target) || !isTextInput(e.target)) return;
      clearTimeout(closeTimer);
      phase = 1;
      schedule();
    };

    const onFocusOut = e => {
      // Focus moving to another field in the same panel → keyboard stays up.
      const next = e.relatedTarget;
      if (next && panel.contains(next) && isTextInput(next)) return;
      // Keep tracking the viewport through the close animation, then release when
      // it has settled back to full (guards against a flash / residual band).
      phase = 2;
      schedule();
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        phase = 0;
        const p = panelRef.current;
        if (p) clearInline(p);
      }, 600);
    };

    panel.addEventListener("focusin", onFocusIn);
    panel.addEventListener("focusout", onFocusOut);
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      panel.removeEventListener("focusin", onFocusIn);
      panel.removeEventListener("focusout", onFocusOut);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(closeTimer);
      const p = panelRef.current;
      if (p) clearInline(p);
    };
  }, [enabled, panelRef, sidePanelQuery]);
}
