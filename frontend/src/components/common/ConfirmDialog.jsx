// Confirm dialog — 2026-03-20 — see _unified-drawer.css
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ConfirmDialog = ({
  show,
  onHide,
  onConfirm,
  title,
  message,
  warning,
  confirmLabel = "Conferma",
  confirmVariant = "danger",
}) => {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setActive(true)));
      return () => cancelAnimationFrame(id);
    }
    setActive(false);
    const t = setTimeout(() => setVisible(false), 200);
    return () => clearTimeout(t);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onKey = e => {
      if (e.key === "Escape") onHide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [show, onHide]);

  if (!visible) return null;

  return createPortal(
    <div className={`cd-root${active ? " cd-root--active" : ""}`}>
      <div className="cd-backdrop" onClick={onHide} />
      <div
        className={`cd-dialog${active ? " cd-dialog--active" : ""}`}
        role="alertdialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="cd-title">{title}</h3>
        {message && <p className="cd-message">{message}</p>}
        {warning && <div className="cd-warning">{warning}</div>}
        <div className="cd-actions">
          <button type="button" className="cd-btn cd-btn--cancel" onClick={onHide}>
            Annulla
          </button>
          <button
            type="button"
            className={`cd-btn cd-btn--confirm cd-btn--${confirmVariant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmDialog;
