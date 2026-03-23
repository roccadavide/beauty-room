import { useEffect, useState } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchMyOrders } from "../../api/modules/orders.api";
// Importa le API delle prenotazioni quando disponibili:
// import { fetchMyBookings } from "../../api/modules/bookings.api";

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

  // Prenotazioni (placeholder — collegare API quando pronta)
  const [bookings] = useState([]);
  const [bookingsLoading] = useState(false);

  const name = user?.name || "Utente";

  useEffect(() => {
    if (!accessToken) { setOrdersLoading(false); return; }
    fetchMyOrders()
      .then(res => setOrders(res || []))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));

    // Quando API prenotazioni pronta:
    // fetchMyBookings().then(setBookings).catch(()=>{}).finally(()=>setBookingsLoading(false));
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
              const st = STATUS_LABELS[b.status] || STATUS_LABELS.CONFIRMED;
              return (
                <div key={b.bookingId} className="ma-order-card">
                  <div className="ma-order-row">
                    <div>
                      <p className="ma-order-num">{b.serviceName || "Trattamento"}</p>
                      <p className="ma-order-date">
                        {b.date
                          ? new Date(b.date).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
                          : "—"}
                        {b.time ? ` · ore ${b.time}` : ""}
                      </p>
                    </div>
                    <span className="ma-status-pill" style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                  </div>
                  {b.note && <p className="ma-order-items-preview">📋 {b.note}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PACCHETTI TAB ── */}
        {activeTab === "pacchetti" && (
          <div className="ma-section">
            <div className="ma-empty">
              <p>I tuoi pacchetti acquistati appariranno qui.</p>
              <button className="ma-cta-btn" onClick={() => navigate("/occasioni")}>
                Scopri i pacchetti →
              </button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
