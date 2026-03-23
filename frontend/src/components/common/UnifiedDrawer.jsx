// Unified drawer shell — 2026-03-20 — see _unified-drawer.css
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useLenisModalLock from "../../hooks/useLenisModalLock";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const UnifiedDrawer = ({ show, onHide, title, subtitle, size = "md", topSlot, children, footer }) => {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelActive, setPanelActive] = useState(false);
  const panelRef = useRef(null);
  const swipeStartY = useRef(null);

  useLenisModalLock(show);

  // Open/close animation
  useEffect(() => {
    if (show) {
      setPanelVisible(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setPanelActive(true)));
      return () => cancelAnimationFrame(id);
    }
    setPanelActive(false);
    const t = setTimeout(() => setPanelVisible(false), 320);
    return () => clearTimeout(t);
  }, [show]);

  // ESC key
  useEffect(() => {
    if (!show) return;
    const onKey = e => {
      if (e.key === "Escape") onHide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [show, onHide]);

  // Focus trap (Tab/Shift+Tab cycle inside panel)
  useEffect(() => {
    if (!show || !panelRef.current) return;
    const panel = panelRef.current;
    const onTab = e => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    panel.addEventListener("keydown", onTab);
    return () => panel.removeEventListener("keydown", onTab);
  }, [show]);

  // Auto-focus first focusable element when panel opens
  useEffect(() => {
    if (panelActive && panelRef.current) {
      const first = panelRef.current.querySelector(FOCUSABLE);
      first?.focus();
    }
  }, [panelActive]);

  // Responsive breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = e => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // VisualViewport: shift bottom-sheet above keyboard (mobile)
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport || isDesktop) return;
    const vv = window.visualViewport;
    const adjust = () => {
      if (panelRef.current) {
        const offsetBottom = window.innerHeight - (vv.offsetTop + vv.height);
        panelRef.current.style.bottom = `${Math.max(0, offsetBottom)}px`;
      }
    };
    vv.addEventListener("resize", adjust);
    vv.addEventListener("scroll", adjust);
    return () => {
      vv.removeEventListener("resize", adjust);
      vv.removeEventListener("scroll", adjust);
    };
  }, [isDesktop]);

  useEffect(() => {
    if (!panelVisible || !panelRef.current) return;
    const body = panelRef.current.querySelector(".ud-body");
    if (!body) return;
    const stopWheel = e => e.stopPropagation();
    body.addEventListener("wheel", stopWheel, { passive: true });
    return () => body.removeEventListener("wheel", stopWheel);
  }, [panelVisible]);

  // Swipe-down-to-close — attached to the handle element
  const handleTouchStart = e => {
    swipeStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = e => {
    if (swipeStartY.current === null || !panelRef.current) return;
    const deltaY = e.touches[0].clientY - swipeStartY.current;
    if (deltaY > 0) {
      // rubber-band effect: real-time transform
      panelRef.current.style.transition = "none";
      panelRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = e => {
    if (swipeStartY.current === null || !panelRef.current) return;
    const deltaY = e.changedTouches[0].clientY - swipeStartY.current;
    // Restore CSS transition
    panelRef.current.style.transition = "";
    panelRef.current.style.transform = "";
    if (deltaY > 80) onHide();
    swipeStartY.current = null;
  };

  if (!panelVisible) return null;

  return createPortal(
    <div className={`ud-root${panelActive ? " ud-root--active" : ""}`}>
      <div className="ud-backdrop" onClick={onHide} />
      <div
        ref={panelRef}
        className={`ud-panel ${isDesktop ? "ud-panel--side" : "ud-panel--sheet"} ud-size--${size} ${panelActive ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        {!isDesktop && <div className="ud-handle" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} />}

        <header className="ud-header">
          <div className="ud-header__info">
            <h2 className="ud-title">{title}</h2>
            {subtitle && <div className="ud-subtitle">{subtitle}</div>}
          </div>
          <button className="ud-close" onClick={onHide} aria-label="Chiudi" type="button">
            ×
          </button>
        </header>

        {topSlot && <div className="ud-top-slot">{topSlot}</div>}

        <div className="ud-body" data-lenis-prevent>
          {children}
        </div>

        {footer && <footer className="ud-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
};

export default UnifiedDrawer;
