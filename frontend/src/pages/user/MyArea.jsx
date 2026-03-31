import { useEffect, useState } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchMyOrders } from "../../api/modules/orders.api";
import { fetchMyBookings } from "../../api/modules/bookings.api";
import { fetchMyPackages } from "../../api/modules/packages.api";

const TABS = [
  { key: "ordini", label: "Ordini" },
  { key: "prenotazioni", label: "Prenotazioni" },
  { key: "pacchetti", label: "Pacchetti" },
];

const STATUS_LABELS = {
  PAID:      { label: "Pagato",    color: "#2d6a4f", bg: "rgba(45,106,79,0.1)"    },
  PENDING:   { label: "In attesa", color: "#b8976a", bg: "rgba(184,151,106,0.12)" },
  CANCELLED: { label: "Cancellato",color: "#c0392b", bg: "rgba(192,57,43,0.1)"    },
  COMPLETED: { label: "Completato",color: "#2e2118", bg: "rgba(46,33,24,0.08)"    },
  CONFIRMED: { label: "Confermata",color: "#2d6a4f", bg: "rgba(45,106,79,0.1)"    },
  BOOKED:    { label: "Prenotata", color: "#2d6a4f", bg: "rgba(45,106,79,0.1)"    },
};

export default function MyArea() {
  const [activeTab, setActiveTab] = useState("ordini");
  const { user, accessToken } = useSelector(s => s.auth);
  const navigate = useNavigate();

  // Ordini
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Prenotazioni
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  // Pacchetti
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);

  const name = user?.name || "Utente";

  const downloadIcs = (booking, date) => {
    const end = new Date(date.getTime() + (booking.durationMin || 60) * 60000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(date)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${booking.serviceName || booking.serviceTitle || "Trattamento Beauty Room"}`,
      "LOCATION:Beauty Room M.R.",
      "DESCRIPTION:Prenotazione confermata",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `beautyroom-${booking.bookingId?.slice(-6)}.ics`;
    a.click();
  };

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
      .catch(() => {})
      .finally(() => setBookingsLoading(false));

    fetchMyPackages()
      .then(res => setPackages(res || []))
      .catch(() => {})
      .finally(() => setPackagesLoading(false));
  }, [accessToken]);

  const totalSpent = orders
    .filter(o => o.orderStatus === "PAID" || o.orderStatus === "COMPLETED")
    .reduce((s, o) => s + (o.orderItems?.reduce((ss, i) => ss + i.price * i.quantity, 0) || 0), 0);

  return (
    <div className="ma-page">
      <Container>
        {/* WELCOME HEADER */}
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

        {/* TABS */}
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

        {/* ── ORDINI TAB ── */}
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
              const st = STATUS_LABELS[order.orderStatus] || STATUS_LABELS.PENDING;
              const total = order.orderItems?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;
              return (
                <div key={order.orderId} className="ma-order-card" onClick={() => navigate("/ordini")}>
                  <div className="ma-order-row">
                    <div>
                      <p className="ma-order-num">Ordine #{order.orderId?.slice(-8).toUpperCase()}</p>
                      <p className="ma-order-date">
                        {new Date(order.createdAt).toLocaleDateString("it-IT", {
                          day: "2-digit", month: "long", year: "numeric",
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
                    {order.orderItems?.length || 0} {order.orderItems?.length === 1 ? "prodotto" : "prodotti"}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PRENOTAZIONI TAB ── */}
        {activeTab === "prenotazioni" && (
          <div className="ma-section">
            {bookingsLoading && (
              <div className="d-flex justify-content-center py-4">
                <Spinner animation="border" />
              </div>
            )}

            {!bookingsLoading && bookings.length === 0 && (
              <div className="ma-empty">
                <p>Non hai ancora prenotazioni.</p>
                <button className="ma-cta-btn" onClick={() => navigate("/trattamenti")}>
                  Prenota un trattamento →
                </button>
              </div>
            )}

            {bookings.map(b => {
              const status = b.status || b.bookingStatus;
              const st = STATUS_LABELS[status] || STATUS_LABELS.CONFIRMED;
              const bookingDate = b.startTime ? new Date(b.startTime) : null;
              const isPast = bookingDate && bookingDate < new Date();
              const isCancellable = bookingDate &&
                bookingDate - new Date() > 24 * 60 * 60 * 1000;

              return (
                <div key={b.bookingId} className="ma-booking-card">
                  <div className="ma-order-row">
                    <div>
                      <p className="ma-order-num">{b.serviceName || b.serviceTitle || "Trattamento"}</p>
                      <p className="ma-order-date">
                        {bookingDate
                          ? bookingDate.toLocaleDateString("it-IT", {
                            weekday: "long", day: "numeric", month: "long", year: "numeric"
                          }) + (b.startTime
                            ? ` · ore ${bookingDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
                            : "")
                          : "—"}
                      </p>
                    </div>
                    <span className="ma-status-pill" style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="ma-booking-actions">
                    {!isPast && bookingDate && (
                      <button
                        className="ma-cal-btn"
                        onClick={() => downloadIcs(b, bookingDate)}
                      >
                        📅 Aggiungi al calendario
                      </button>
                    )}
                    {isCancellable && status !== "CANCELLED" && (
                      <span className="ma-cancel-note">
                        Per cancellare contatta Michela
                      </span>
                    )}
                    {!isCancellable && !isPast && status !== "CANCELLED" && (
                      <span className="ma-cancel-note">
                        Cancellazione non disponibile online (meno di 24h). Contatta Michela.
                      </span>
                    )}
                  </div>
                  {(b.notes || b.note) && <p className="ma-order-items-preview">📋 {b.notes || b.note}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PACCHETTI TAB ── */}
        {activeTab === "pacchetti" && (
          <div className="ma-section">
            {packagesLoading && (
              <div className="d-flex justify-content-center py-4">
                <Spinner animation="border" />
              </div>
            )}

            {!packagesLoading && packages.length === 0 && (
              <div className="ma-empty">
                <p>Non hai ancora pacchetti acquistati.</p>
                <button className="ma-cta-btn" onClick={() => navigate("/occasioni")}>
                  Scopri i pacchetti →
                </button>
              </div>
            )}

            {packages.map(pkg => {
              const pct = pkg.sessionsTotal > 0
                ? Math.round((pkg.sessionsUsed / pkg.sessionsTotal) * 100)
                : 0;
              const isActive = pkg.status === "ACTIVE";
              const pillStyle = isActive
                ? { color: "#2d6a4f", background: "rgba(45,106,79,0.10)" }
                : { color: "#9c8880", background: "rgba(156,136,128,0.10)" };
              const pillLabel = {
                ACTIVE:    "Attivo",
                COMPLETED: "Completato",
                EXPIRED:   "Scaduto",
                EXHAUSTED: "Esaurito",
                CANCELLED: "Cancellato",
              }[pkg.status] ?? pkg.status;

              return (
                <div key={pkg.packageCreditId} className="ma-pkg-card">
                  <div className="ma-pkg-header">
                    <div>
                      <p className="ma-pkg-name">{pkg.serviceName}</p>
                      {pkg.serviceOptionName && (
                        <p className="ma-pkg-desc">{pkg.serviceOptionName}</p>
                      )}
                    </div>
                    <span className="ma-status-pill" style={pillStyle}>
                      {pillLabel}
                    </span>
                  </div>

                  <div className="ma-pkg-progress-wrap">
                    <div className="ma-pkg-progress-bar">
                      <div className="ma-pkg-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="ma-pkg-progress-label">
                      {pkg.sessionsUsed} / {pkg.sessionsTotal} sedute utilizzate
                      {isActive && (
                        <strong> · {pkg.sessionsRemaining} rimanenti</strong>
                      )}
                    </span>
                  </div>

                  <div className="ma-pkg-footer">
                    <span className="ma-pkg-date">
                      Acquistato il{" "}
                      {new Date(pkg.purchasedAt).toLocaleDateString("it-IT", {
                        day: "2-digit", month: "long", year: "numeric",
                      })}
                    </span>
                    {pkg.expiryDate && isActive && (
                      <span className="ma-pkg-date">
                        Scade il{" "}
                        {new Date(pkg.expiryDate).toLocaleDateString("it-IT", {
                          day: "2-digit", month: "long", year: "numeric",
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
