import { useEffect } from "react";

// Chrome iOS (CriOS) only: after the virtual keyboard closes, the WKWebView wrapper
// sometimes fails to re-expand the webview, leaving the page shifted up with a white
// strip at the bottom. Re-applying the current scroll position (a no-op value) forces
// Chrome to re-measure and settle. Two triggers feed one debounced resnap:
//   1. visualViewport "resize" open→closed edge — the precise signal, when emitted
//   2. document "focusout" from a text field — fallback for closes that emit no
//      clean visualViewport resize
// Safari iOS / desktop / Android attach nothing and stay byte-identical.
export default function useChromeIosKeyboardResnap() {
  useEffect(() => {
    if (!/CriOS\//.test(navigator.userAgent)) return;

    let timer = 0;
    // shared debounce: both triggers collapse into a single scrollTo, never twice in a row
    const resnap = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.scrollTo(window.scrollX, window.scrollY);
      }, 120);
    };

    // ── Trigger 1: visualViewport resize, open→closed edge ──
    const vv = window.visualViewport;
    let onVVResize;
    if (vv) {
      // Same heuristic as UnifiedDrawer: innerHeight stays full on iOS while the keyboard
      // only shrinks visualViewport. ≥180px ⇒ real keyboard, not the address-bar toolbar.
      const KEYBOARD_THRESHOLD_PX = 180;
      const keyboardOpen = () => window.innerHeight - vv.height >= KEYBOARD_THRESHOLD_PX;
      let wasOpen = keyboardOpen();
      onVVResize = () => {
        const isOpen = keyboardOpen();
        if (wasOpen && !isOpen) resnap(); // just closed
        wasOpen = isOpen;
      };
      vv.addEventListener("resize", onVVResize);
    }

    // ── Trigger 2: focusout from a text field (fallback) ──
    const onFocusOut = e => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        resnap();
      }
    };
    document.addEventListener("focusout", onFocusOut);

    return () => {
      if (vv && onVVResize) vv.removeEventListener("resize", onVVResize);
      document.removeEventListener("focusout", onFocusOut);
      clearTimeout(timer);
    };
  }, []);
}
