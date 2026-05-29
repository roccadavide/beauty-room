import { useEffect } from "react";
import { motion } from "framer-motion";
import { pushLenisLock, popLenisLock } from "../../hooks/useLenis";

// Full-page "drawer" surface for virtual-keyboard devices. Renders in NORMAL
// document flow — NO position:fixed, and NO keyboard/viewport-resize listeners —
// so the iOS/Chrome-iOS keyboard strip+jump bug (fixed top+bottom elements not
// shrinking with the keyboard) structurally cannot occur. Slides up on mount
// (transform only); the app-level AnimatePresence (keyed by pathname) plays the
// slide-down on exit. `bare` skips the text header for content that brings its
// own chrome (the promo banner header). Same chrome-prop contract as
// UnifiedDrawer, minus `show`.
export default function BookingRouteShell({ title, subtitle, topSlot, footer, size = "sm", onHide, bare = false, children }) {
  // Stop Lenis while mounted, restart on unmount (ref-counted — never unbalances
  // across a promo→booking sequence). React guarantees this cleanup runs on ANY
  // unmount: close, browser back, error boundary, abrupt navigation.
  useEffect(() => {
    pushLenisLock();
    return () => popLenisLock();
  }, []);

  return (
    <div className="br-root" data-lenis-prevent>
      <motion.div
        className={`br-panel br-size--${size}${bare ? " br-panel--bare" : ""}`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
        style={{ willChange: "transform" }}
      >
        {!bare && (title || topSlot) && (
          <div className="br-stickytop">
            {title != null && (
              <header className="br-header">
                <div className="ud-header__info">
                  <h2 className="ud-title">{title}</h2>
                  {subtitle && <div className="ud-subtitle">{subtitle}</div>}
                </div>
                <button className="ud-close" onClick={onHide} aria-label="Chiudi" type="button">
                  ×
                </button>
              </header>
            )}
            {topSlot && <div className="ud-top-slot br-top-slot">{topSlot}</div>}
          </div>
        )}

        {bare ? children : <div className="br-body">{children}</div>}

        {footer && <footer className="ud-footer br-footer">{footer}</footer>}
      </motion.div>
    </div>
  );
}
