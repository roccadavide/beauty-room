import { useEffect, useState } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchMyOrders } from "../../api/modules/orders.api";
import { fetchMyBookings } from "../../api/modules/bookings.api";
import { fetchMyPackages } from "../../api/modules/packages.api";
import SEO from "../../components/common/SEO";

const TABS = [
  { key: "ordini", label: "Ordini" },
  { key: "prenotazioni", label: "Prenotazioni" },
  { key: "pacchetti", label: "Pacchetti" },
];

const ORDER_STATUS_LABELS = {
  PAID:      { label: "Pagato",    color: "#2d6a4f", bg: "rgba(45,106,79,0.1)" },
  PENDING:   { label: "In attesa", color: "#b8976a", bg: "rgba(184,151,106,0.12)" },
  CANCELLED: { label: "Cancellato",color: "#c0392b", bg: "rgba(192,57,43,0.1)" },
  COMPLETED: { label: "Completato",color: "#2e2118", bg: "rgba(46,33,24,0.08)" },
};

const BOOKING_STATUS_LABELS = {
  CONFIRMED: { label: "Confermata",  color: "#2d6a4f", bg: "rgba(45,106,79,0.1)" },
  BOOKED:    { label: "Prenotata",   color: "#2d6a4f", bg: "rgba(45,106,79,0.1)" },
  COMPLETED: { label: "Completata",  color: "#9e8272", bg: "rgba(158,130,114,0.1)" },
  CANCELLED: { label: "Cancellata",  color: "#c0392b", bg: "rgba(192,57,43,0.1)" },
  NO_SHOW:   { label: "Non presentata", color: "#c0392b", bg: "rgba(192,57,43,0.08)" },
};

const PKG_STATUS_LABELS = {
  ACTIVE:    { label: "Attivo",      color: "#2d6a4f", bg: "rgba(45,106,79,0.1)" },
  EXHAUSTED: { label: "Esaurito",    color: "#9c8880", bg: "rgba(156,136,128,0.1)" },
  COMPLETED: { label: "Completato",  color: "#9c8880", bg: "rgba(156,136,128,0.1)" },
  EXPIRED:   { label: "Scaduto",     color: "#9c8880", bg: "rgba(156,136,128,0.1)" },
  CANCELLED: { label: "Cancellato",  color: "#c0392b", bg: "rgba(192,57,43,0.08)" },
};

// Resolve the display name for a booking's service(s)
function resolveServiceName(b) {
  if (Array.isArray(b.services) && b.services.length > 0) {
    const names = b.services.map(s => s.name || s.serviceName).filter(Boolean);
    if (names.length > 0) {
      const label = names.join(" + ");
      if (b.isCustomService && b.customServiceName) return `${label} + ${b.customServiceName}`;
      return label;
    }
  }
  if (b.isCustomService && b.customServiceName) return b.customServiceName;
  return b.serviceTitle || b.serviceName || "Trattamento";
}

// Format duration in minutes to "Xh Ymin" or "Ymin"
function formatDuration(mins) {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function downloadIcs(booking, date) {
  const end = new Date(date.getTime() + (booking.durationMinutes || booking.durationMin || 60) * 60000);
  const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(date)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${resolveServiceName(booking)}`,
    "LOCATION:Beauty Room M.R.",
    "DESCRIPTION:Prenotazione confermata",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `beautyroom-${String(booking.bookingId || "").slice(-6)}.ics`;
  a.click();
}

export default function MyArea() {
  const [activeTab, setActiveTab] = useState("ordini");
  const { user, accessToken } = useSelector(s => s.auth);
  const navigate = useNavigate();

  const [orders, setOrders]                   = useState([]);
  const [ordersLoading, setOrdersLoading]     = useState(true);

  const [bookings, setBookings]               = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError]     = useState("");

  const [packages, setPackages]               = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError]     = useState("");

  const name = user?.name || "Utente";

  useEffect(() => {
    if (!accessToken) {
      setOrdersLoading(false);
      setBookingsLoading(false);
      setPackagesLoading(false);
      return;
    }

    setOrdersLoading(true);
    setBookingsLoading(true);
    setPackagesLoading(true);

    fetchMyOrders()
      .then(res => setOrders(res || []))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));

    fetchMyBookings()
      .then(res => setBookings(res || []))
      .catch(() => setBookingsError("Impossibile caricare le prenotazioni. Riprova più tardi."))
      .finally(() => setBookingsLoading(false));

    fetchMyPackages()
      .then(res => setPackages(res || []))
      .catch(() => setPackagesError("Impossibile caricare i pacchetti. Riprova più tardi."))
      .finally(() => setPackagesLoading(false));
  }, [accessToken]);

  const totalSpent = orders
    .filter(o => o.orderStatus === "PAID" || o.orderStatus === "COMPLETED")
    .reduce((s, o) => s + (o.orderItems?.reduce((ss, i) => ss + i.price * i.quantity, 0) || 0), 0);

  return (
    <div className="ma-page">
      <SEO
        title="Area personale"
        description="La tua area riservata Beauty Room: prenotazioni, ordini e pacchetti trattamenti."
        noindex={true}
      />
      <Container>

        {/* ── WELCOME HEADER ─────────────────────────────────────────────────── */}
        <div className="ma-welcome">
          <div className="ma-welcome-avatar">{name[0]?.toUpperCase()}</div>
          <div>
            <p className="ma-welcome-eyebrow">La tua area personale</p>
            <h1 className="ma-welcome-name">Ciao, {name}</h1>
          </div>
          <div className="ma-stats">
            <div className="ma-stat">
              <span className="ma-stat-val">{orders.length}</span>
              <span className="ma-stat-label">Ordini</span>
            </div>
            <div className="ma-stat">
              <span className="ma-stat-val">{bookings.length}</span>
              <span className="ma-stat-label">Prenotazioni</span>
            </div>
            <div className="ma-stat">
              <span className="ma-stat-val">{packages.filter(p => p.status === "ACTIVE").length}</span>
              <span className="ma-stat-label">Pacchetti</span>
            </div>
            <div className="ma-stat">
              <span className="ma-stat-val">€ {totalSpent.toFixed(0)}</span>
              <span className="ma-stat-label">Speso</span>
            </div>
          </div>
        </div>

        {/* ── TABS ───────────────────────────────────────────────────────────── */}
        <div className="ma-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`ma-tab${activeTab === t.key ? " ma-tab--active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ ORDINI TAB ═══════════════════════════════════════════════════════ */}
        {activeTab === "ordini" && (
          <div className="ma-section">
            {ordersLoading && (
              <div className="d-flex justify-content-center py-4">
                <Spinner animation="border" />
              </div>
            )}

            {!ordersLoading && orders.length === 0 && (
              <div className="ma-empty">
                <p>Non hai ancora effettuato ordini.</p>
                <button className="ma-cta-btn" onClick={() => navigate("/prodotti")}>
                  Esplora i prodotti →
                </button>
              </div>
            )}

            {orders.map(order => {
              const st = ORDER_STATUS_LABELS[order.orderStatus] || ORDER_STATUS_LABELS.PENDING;
              const total = order.orderItems?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;
              return (
                <div key={order.orderId} className="ma-order-card" onClick={() => navigate("/ordini")}>
                  <div className="ma-order-row">
                    <div>
                      <p className="ma-order-num">Ordine #{order.orderId?.slice(-8).toUpperCase()}</p>
                      <p className="ma-order-date">
                        {new Date(order.createdAt).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                      <span className="ma-status-pill" style={{ color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                      <span className="ma-order-total">€ {total.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="ma-order-items-preview">
                    {order.orderItems?.length || 0}{" "}
                    {order.orderItems?.length === 1 ? "prodotto" : "prodotti"}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ PRENOTAZIONI TAB ═════════════════════════════════════════════════ */}
        {activeTab === "prenotazioni" && (
          <div className="ma-section">
            {bookingsLoading && (
              <div className="d-flex justify-content-center py-4">
                <Spinner animation="border" />
              </div>
            )}

            {!bookingsLoading && bookingsError && (
              <div className="ma-error-msg">{bookingsError}</div>
            )}

            {!bookingsLoading && !bookingsError && bookings.length === 0 && (
              <div className="ma-empty">
                <p>Non hai ancora prenotazioni.</p>
                <button className="ma-cta-btn" onClick={() => navigate("/trattamenti")}>
                  Scopri i nostri trattamenti →
                </button>
              </div>
            )}

            {!bookingsLoading && bookings.map(b => {
              const status = b.bookingStatus || b.status;
              const st = BOOKING_STATUS_LABELS[status] || BOOKING_STATUS_LABELS.CONFIRMED;
              const bookingDate = b.startTime ? new Date(b.startTime) : null;
              const now = new Date();
              const isPast = bookingDate && bookingDate < now;
              const isCompleted = status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW";
              const isCancellable = bookingDate && bookingDate - now > 24 * 60 * 60 * 1000;
              const isLinkedByMichela = b.linkingStatus === "LINKED";
              const serviceName = resolveServiceName(b);
              const duration = formatDuration(b.durationMinutes);

              const cardClass = [
                "ma-booking-card",
                !isPast && !isCompleted ? "ma-booking-card--upcoming" : "",
                isCompleted ? "ma-booking-card--past" : "",
              ].filter(Boolean).join(" ");

              return (
                <div key={b.bookingId} className={cardClass}>
                  <div className="ma-booking-header">
                    <div className="ma-booking-meta">
                      {/* Service name */}
                      <p className="ma-booking-service">
                        {b.isCustomService
                          ? <em>{serviceName}</em>
                          : serviceName}
                      </p>

                      {/* Date + time */}
                      <p className="ma-order-date">
                        {bookingDate
                          ? bookingDate.toLocaleDateString("it-IT", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }) +
                            ` · ore ${bookingDate.toLocaleTimeString("it-IT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "—"}
                        {duration && <span className="ma-booking-duration"> · {duration}</span>}
                      </p>
                    </div>

                    <div className="ma-booking-badges">
                      <span className="ma-status-pill" style={{ color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                      {isLinkedByMichela && (
                        <span className="ma-linked-badge">Aggiunto da Michela</span>
                      )}
                    </div>
                  </div>

                  {/* Session pill + package link */}
                  {(b.currentSession && b.totalSessions) || b.linkedPackage ? (
                    <div className="ma-booking-pills">
                      {b.currentSession && b.totalSessions ? (
                        <span className="ma-session-pill">
                          Seduta {b.currentSession} di {b.totalSessions}
                        </span>
                      ) : null}
                      {b.linkedPackage?.packageName ? (
                        <span className="ma-pkg-pill">
                          Pacchetto: {b.linkedPackage.packageName}
                          {Number.isFinite(b.linkedPackage.sessionsRemaining)
                            ? ` · ${b.linkedPackage.sessionsRemaining} rimanenti`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Notes */}
                  {(b.notes || b.note) && (
                    <p className="ma-booking-notes">📋 {b.notes || b.note}</p>
                  )}

                  {/* Actions */}
                  <div className="ma-booking-actions">
                    {!isPast && bookingDate && (
                      <button className="ma-cal-btn" onClick={() => downloadIcs(b, bookingDate)}>
                        📅 Aggiungi al calendario
                      </button>
                    )}
                    {isCancellable && status !== "CANCELLED" && (
                      <span className="ma-cancel-note">Per cancellare contatta Michela</span>
                    )}
                    {!isCancellable && !isPast && status !== "CANCELLED" && (
                      <span className="ma-cancel-note">
                        Cancellazione non disponibile (meno di 24h). Contatta Michela.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ PACCHETTI TAB ════════════════════════════════════════════════════ */}
        {activeTab === "pacchetti" && (
          <div className="ma-section">
            {packagesLoading && (
              <div className="d-flex justify-content-center py-4">
                <Spinner animation="border" />
              </div>
            )}

            {!packagesLoading && packagesError && (
              <div className="ma-error-msg">{packagesError}</div>
            )}

            {!packagesLoading && !packagesError && packages.length === 0 && (
              <div className="ma-empty">
                <p>Non hai pacchetti attivi.</p>
              </div>
            )}

            {!packagesLoading && packages.map(pkg => {
              const total = pkg.totalSessions || 0;
              const used = total - (pkg.sessionsRemaining || 0);
              const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
              const isActive = pkg.status === "ACTIVE";
              const st = PKG_STATUS_LABELS[pkg.status] || PKG_STATUS_LABELS.ACTIVE;

              return (
                <div
                  key={pkg.id}
                  className={`ma-pkg-card${!isActive ? " ma-pkg-card--exhausted" : ""}`}
                >
                  <div className="ma-pkg-header">
                    <div>
                      <p className="ma-pkg-name">{pkg.displayName}</p>
                      {pkg.serviceOptionName && pkg.customPackageName == null && (
                        <p className="ma-pkg-desc">{pkg.serviceOptionName}</p>
                      )}
                    </div>
                    <span className="ma-status-pill" style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="ma-pkg-progress-wrap">
                    <div
                      className="ma-pkg-progress-bar"
                      role="progressbar"
                      aria-valuenow={used}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-label={`${used} di ${total} sedute utilizzate`}
                    >
                      <div className="ma-pkg-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="ma-pkg-progress-label">
                      {used} / {total} sedute utilizzate
                      {isActive && pkg.sessionsRemaining > 0 && (
                        <strong> · {pkg.sessionsRemaining} rimanenti</strong>
                      )}
                      {!isActive && pkg.status === "EXHAUSTED" && (
                        <strong className="ma-pkg-exhausted"> · Esaurito</strong>
                      )}
                    </span>
                  </div>

                  <div className="ma-pkg-footer">
                    {pkg.createdAt && (
                      <span className="ma-pkg-date">
                        Acquistato il{" "}
                        {new Date(pkg.createdAt).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </Container>
    </div>
  );
}
