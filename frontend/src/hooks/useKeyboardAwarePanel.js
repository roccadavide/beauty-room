import { useEffect } from "react";

/**
 * Lifts a fixed-position panel above the iOS virtual keyboard.
 *
 * Listens to `visualViewport` resize/scroll events and applies an inline
 * `bottom` to the panel equal to the gap between the visual viewport bottom
 * and the layout viewport bottom — but ONLY while a text input descendant
 * of the panel is focused. This focus gate replaces the previous pixel
 * threshold (180px) and removes the chrome-vs-keyboard ambiguity that left
 * a residual gap on iOS Safari.
 *
 * @param {React.RefObject<HTMLElement>} panelRef ref to the panel element
 * @param {boolean} enabled false to disable (e.g., panel closed)
 */
export default function useKeyboardAwarePanel(panelRef, enabled) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !window.visualViewport) return;
    const panel = panelRef.current;
    if (!panel) return;

    const vv = window.visualViewport;
    let keyboardLikelyOpen = false;

    const isTextInput = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "TEXTAREA") return true;
      if (tag === "INPUT") {
        const t = (el.type || "text").toLowerCase();
        return ![
          "button", "submit", "reset", "checkbox", "radio",
          "file", "image", "range", "color",
        ].includes(t);
      }
      return el.isContentEditable === true;
    };

    const adjust = () => {
      const p = panelRef.current;
      if (!p) return;
      if (!keyboardLikelyOpen) {
        p.style.bottom = "";
        return;
      }
      const offsetBottom = Math.max(
        0,
        window.innerHeight - (vv.offsetTop + vv.height)
      );
      p.style.bottom = offsetBottom > 0 ? `${offsetBottom}px` : "";
    };

    const onFocusIn = (e) => {
      if (!panel.contains(e.target)) return;
      if (!isTextInput(e.target)) return;
      keyboardLikelyOpen = true;
      // wait a frame for the visual viewport to update
      requestAnimationFrame(adjust);
    };

    const onFocusOut = (e) => {
      // ignore focus moving to another text input within the same panel
      const next = e.relatedTarget;
      if (next && panel.contains(next) && isTextInput(next)) return;
      keyboardLikelyOpen = false;
      requestAnimationFrame(adjust);
    };

    panel.addEventListener("focusin", onFocusIn);
    panel.addEventListener("focusout", onFocusOut);
    vv.addEventListener("resize", adjust);
    vv.addEventListener("scroll", adjust);

    return () => {
      panel.removeEventListener("focusin", onFocusIn);
      panel.removeEventListener("focusout", onFocusOut);
      vv.removeEventListener("resize", adjust);
      vv.removeEventListener("scroll", adjust);
      if (panelRef.current) panelRef.current.style.bottom = "";
    };
  }, [enabled, panelRef]);
}
