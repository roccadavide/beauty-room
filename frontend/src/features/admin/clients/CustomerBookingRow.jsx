import { formatDateTimeIT } from "./clientsHelpers";
import "./CustomerBookingRow.css";

/**
 * One rich history row built from a full AdminBookingCardDTO. Deliberately does
 * NOT reuse the agenda's renderer — it reads the same fields but renders a
 * compact, labels-only summary (no prices, no paid flags). Used twice:
 *   • upcoming  → clickable (opens the appointment drawer in edit)
 *   • past      → static (read-only history)
 */

// Build the homogeneous entry list in the agenda's vocabulary order:
// packages → catalog services → custom → promotions → products → fallback.
function buildEntries(card) {
  const entries = [];

  // Packages (📦) — new plural list, falling back to the deprecated singular.
  const pkgs = card.linkedPackages?.length ? card.linkedPackages : card.linkedPackage ? [card.linkedPackage] : [];
  pkgs.forEach((p, i) => {
    const name = p.packageName || p.serviceTitle || p.serviceName || "Pacchetto";
    // Prefer the package link's own session numbers; for the first package on a
    // legacy row that lacks them, fall back to the card-level current/total.
    const sessionNumber = p.sessionNumber || (i === 0 ? card.currentSession : null);
    const totalSessions = p.totalSessions || (i === 0 ? card.totalSessions : null);
    const badge = sessionNumber && totalSessions ? `Seduta ${sessionNumber}/${totalSessions}` : null;
    entries.push({ icon: "📦", text: name, badge });
  });

  // Catalog services — each with its option.
  (card.services || []).forEach(s => {
    const name = s.name || s.title || s.serviceName || "Servizio";
    entries.push({ text: s.optionName ? `${name} · ${s.optionName}` : name });
  });

  // Custom (free-form) service — italic.
  if (card.customServiceName) entries.push({ text: card.customServiceName, italic: true });

  // Promotions (🏷️).
  (card.linkedPromotions || []).forEach(pr => entries.push({ icon: "🏷️", text: pr.title || "Promozione" }));

  // Products (🛍️).
  (card.linkedSales || []).forEach(sale => {
    const qty = sale.quantity > 1 ? ` ×${sale.quantity}` : "";
    entries.push({ icon: "🛍️", text: `${sale.productName || "Prodotto"}${qty}` });
  });

  // Fallback — nothing above produced a line (e.g. a bare single-service legacy row).
  if (entries.length === 0) {
    const t = card.serviceTitle ? (card.optionName ? `${card.serviceTitle} · ${card.optionName}` : card.serviceTitle) : "—";
    entries.push({ text: t });
  }

  return entries;
}

export default function CustomerBookingRow({ card, clickable = false, onClick }) {
  const status = card.bookingStatus ?? card.status;
  const entries = buildEntries(card);

  const activate = () => {
    if (clickable && onClick) onClick(card);
  };
  const handleKeyDown = e => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  const clickProps = clickable ? { role: "button", tabIndex: 0, onClick: activate, onKeyDown: handleKeyDown } : {};

  return (
    <div className={`cli-history-item cbr-row${clickable ? " cbr-row--clickable" : ""}`} {...clickProps}>
      <div className="cli-history-main cbr-main">
        <div className="cbr-top">
          <span className="cli-history-meta">{formatDateTimeIT(card.startTime)}</span>
        </div>
        <ul className="cbr-entries">
          {entries.map((e, i) => (
            <li key={i} className={`cbr-entry${e.italic ? " cbr-entry--custom" : ""}`}>
              {e.icon && <span className="cbr-entry__icon">{e.icon}</span>}
              <span className="cbr-entry__text">{e.text}</span>
              {e.badge && <span className="cbr-entry__badge">{e.badge}</span>}
            </li>
          ))}
        </ul>
      </div>
      {clickable && <span className="cbr-hint">Modifica ✏</span>}
    </div>
  );
}
