import { useEffect, useMemo, useState } from "react";
import { Spinner } from "react-bootstrap";
import DateTimeField from "../../components/common/DateTimeField";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";
import useLenisModalLock from "../../hooks/useLenisModalLock";
import { useClosedDays } from "../../hooks/useClosedDays";
import { fetchMyBookings } from "../../api/modules/bookings.api";

const pad2 = n => String(n).padStart(2, "0");

const fmtDate = iso => {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
};

const fmtTime = iso => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * PayNowModal — drawer laterale per "Paga ora"
 *
 * Props:
 *   show: boolean
 *   onHide: () => void
 *   product: { productId, name, price, images }
 *   qty: number
 *   user: object | null
 *   accessToken: string | null
 *   onCheckoutAuth: (orderData) => Promise<void>
 *   onCheckoutGuest: (orderData) => Promise<void>
 */
export default function PayNowModal({
  show, onHide, product, qty, user, accessToken,
  onCheckoutAuth, onCheckoutGuest, onCheckoutPayInStore
}) {
  const [form, setForm] = useState({
    name: "", surname: "", email: "", phone: "", pickupNote: ""
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const [futureBookings, setFutureBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [pickupMode, setPickupMode] = useState("custom");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [pickupSpecific, setPickupSpecific] = useState("");

  useLenisModalLock(show);

  const { closedDates, closedWeekdays, isClosed } = useClosedDays();
  const disabledDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      if (isClosed(iso)) dates.push(iso);
    }
    return dates;
  }, [closedDates, closedWeekdays, isClosed]);

  useEffect(() => {
    if (!show) return;
    setSubmitted(false);
    setErrors({});
    setServerError(null);
    setSelectedBooking(null);
    setPickupMode("custom");
    setPickupDate("");
    setPickupTime("");
    setPickupSpecific("");

    if (user) {
      setForm({
        name: user.name || "",
        surname: user.surname || "",
        email: user.email || "",
        phone: user.phone || "",
        pickupNote: ""
      });
    } else {
      setForm({ name: "", surname: "", email: "", phone: "", pickupNote: "" });
    }
  }, [show, user]);

  useEffect(() => {
    if (!show || !accessToken) return;
    let cancelled = false;
    setBookingsLoading(true);

    fetchMyBookings()
      .then(bookings => {
        if (cancelled) return;
        const now = new Date();
        const future = (bookings || [])
          .filter(b => {
            const start = new Date(b.startTime);
            return start > now && (b.bookingStatus === "CONFIRMED" || b.bookingStatus === "PENDING");
          })
          .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        setFutureBookings(future);
        if (future.length > 0) {
          setPickupMode("booking");
          setSelectedBooking(future[0]);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBookingsLoading(false); });

    return () => { cancelled = true; };
  }, [show, accessToken]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nome obbligatorio";
    if (!form.surname.trim()) e.surname = "Cognome obbligatorio";
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Email non valida";
    if (!/^\+?[0-9]{7,15}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "Telefono non valido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPickupNote = () => {
    if (pickupMode === "booking" && selectedBooking) {
      return `Da ritirare durante l'appuntamento del ${fmtDate(selectedBooking.startTime)} alle ${fmtTime(selectedBooking.startTime)} (${selectedBooking.serviceTitle || "trattamento"})`;
    }
    if (pickupDate) {
      const d = new Date(pickupDate).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
      const t = pickupTime === "mattina" ? " — mattina"
              : pickupTime === "pomeriggio" ? " — pomeriggio"
              : pickupSpecific ? ` — ore ${pickupSpecific}`
              : "";
      return `Preferisco ritirare il ${d}${t}`;
    }
    if (form.pickupNote) return form.pickupNote;
    return "";
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!validate()) return;
    setLoading(true);
    setServerError(null);

    const orderData = {
      customerName: form.name,
      customerSurname: form.surname,
      customerEmail: form.email,
      customerPhone: form.phone,
      pickupNote: buildPickupNote(),
      items: [{ productId: product.productId, quantity: qty }]
    };

    try {
      if (accessToken) {
        await onCheckoutAuth(orderData);
      } else {
        await onCheckoutGuest(orderData);
      }
    } catch (err) {
      setServerError(err.message || "Errore durante il pagamento.");
    } finally {
      setLoading(false);
    }
  };

  const handlePayInStore = async () => {
    setSubmitted(true);
    if (!validate()) return;
    setLoading(true);
    setServerError(null);

    const orderData = {
      customerName: form.name,
      customerSurname: form.surname,
      customerEmail: form.email,
      customerPhone: form.phone,
      pickupNote: buildPickupNote(),
      items: [{ productId: product.productId, quantity: qty }]
    };

    try {
      await onCheckoutPayInStore(orderData);
    } catch (err) {
      setServerError(err.message || "Errore durante la creazione dell'ordine.");
    } finally {
      setLoading(false);
    }
  };

  const onChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalStr = (product?.price * qty).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  return (
    <UnifiedDrawer
      show={show}
      onHide={onHide}
      title="Completa l'acquisto"
      subtitle={`${product?.name} · ${qty > 1 ? `${qty} pz · ` : ""}${totalStr}`}
      size="md"
      footer={
        <div className="d-flex flex-column w-100 gap-2">
          <div className="d-flex justify-content-between align-items-center w-100">
            <button className="bm-btn bm-btn--ghost" onClick={onHide} disabled={loading}>Annulla</button>
            <button className="bm-btn bm-btn--primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : "💳 Procedi al pagamento →"}
            </button>
          </div>
          {onCheckoutPayInStore && user?.isVerified && accessToken && (
            <button
              className="bm-btn bm-btn--pay-in-store w-100"
              onClick={handlePayInStore}
              disabled={loading}
              type="button"
            >
              🏠 Paga al ritiro (Cliente di Fiducia)
            </button>
          )}
        </div>
      }
    >
      {serverError && (
        <div className="pnm-error mb-3">
          {serverError}
          <button onClick={() => setServerError(null)} className="pnm-error-close">×</button>
        </div>
      )}

      {/* ── SEZIONE DATI ── */}
      <div className="pnm-section">
        <div className="pnm-section-title">I tuoi dati</div>

        <div className="pnm-field-row">
          <div className="pnm-field">
            <label className="pnm-label">Nome *</label>
            <input
              className={`pnm-input${submitted && errors.name ? " pnm-input--err" : ""}`}
              value={form.name}
              onChange={e => onChange("name", e.target.value)}
              placeholder="Nome"
              disabled={loading}
            />
            {submitted && errors.name && <span className="pnm-err-msg">{errors.name}</span>}
          </div>
          <div className="pnm-field">
            <label className="pnm-label">Cognome *</label>
            <input
              className={`pnm-input${submitted && errors.surname ? " pnm-input--err" : ""}`}
              value={form.surname}
              onChange={e => onChange("surname", e.target.value)}
              placeholder="Cognome"
              disabled={loading}
            />
            {submitted && errors.surname && <span className="pnm-err-msg">{errors.surname}</span>}
          </div>
        </div>

        <div className="pnm-field-row">
          <div className="pnm-field">
            <label className="pnm-label">Email *</label>
            <input
              className={`pnm-input${submitted && errors.email ? " pnm-input--err" : ""}`}
              type="email"
              value={form.email}
              onChange={e => onChange("email", e.target.value)}
              placeholder="email@esempio.it"
              disabled={loading}
            />
            {submitted && errors.email && <span className="pnm-err-msg">{errors.email}</span>}
          </div>
          <div className="pnm-field">
            <label className="pnm-label">Telefono *</label>
            <input
              className={`pnm-input${submitted && errors.phone ? " pnm-input--err" : ""}`}
              type="tel"
              value={form.phone}
              onChange={e => onChange("phone", e.target.value)}
              placeholder="+39 ..."
              disabled={loading}
            />
            {submitted && errors.phone && <span className="pnm-err-msg">{errors.phone}</span>}
          </div>
        </div>
      </div>

      {/* ── SEZIONE RITIRO ── */}
      <div className="pnm-section">
        <div className="pnm-section-title">Quando vuoi ritirare?</div>

        {bookingsLoading && (
          <div className="d-flex align-items-center gap-2 pnm-loading">
            <Spinner size="sm" animation="border" />
            <span>Controllo i tuoi appuntamenti…</span>
          </div>
        )}

        {!bookingsLoading && futureBookings.length > 0 && (
          <>
            <div className="pnm-pickup-tabs">
              <button
                className={`pnm-pickup-tab${pickupMode === "booking" ? " active" : ""}`}
                onClick={() => setPickupMode("booking")}
                type="button"
              >
                Durante un appuntamento
              </button>
              <button
                className={`pnm-pickup-tab${pickupMode === "custom" ? " active" : ""}`}
                onClick={() => setPickupMode("custom")}
                type="button"
              >
                Altra data
              </button>
            </div>

            {pickupMode === "booking" && (
              <div className="pnm-bookings-list">
                {futureBookings.slice(0, 5).map(b => (
                  <label
                    key={b.bookingId}
                    className={`pnm-booking-option${selectedBooking?.bookingId === b.bookingId ? " selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="booking-select"
                      checked={selectedBooking?.bookingId === b.bookingId}
                      onChange={() => setSelectedBooking(b)}
                      style={{ display: "none" }}
                    />
                    <div className="pnm-booking-date">{fmtDate(b.startTime)}</div>
                    <div className="pnm-booking-meta">ore {fmtTime(b.startTime)} · {b.serviceTitle || "Trattamento"}</div>
                    <span className="pnm-booking-check">{selectedBooking?.bookingId === b.bookingId ? "✓" : ""}</span>
                  </label>
                ))}
                <p className="pnm-booking-note">
                  Il prodotto sarà pronto al tuo arrivo — nessuna spedizione, ritiro in negozio.
                </p>
              </div>
            )}
          </>
        )}

        {(pickupMode === "custom" || futureBookings.length === 0) && !bookingsLoading && (
          <div className="pnm-custom-pickup">
            <div className="pnm-field">
              <DateTimeField
                label="Data preferita (opzionale)"
                mode="date"
                value={pickupDate}
                onChange={iso => setPickupDate(iso)}
                minDate={new Date()}
                disabledDates={disabledDates}
                disabled={loading}
                placeholder="Scegli un giorno"
              />
            </div>

            {pickupDate && (
              <div className="pnm-time-opts">
                {["mattina", "pomeriggio", "specifico"].map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`pnm-time-chip${pickupTime === t ? " active" : ""}`}
                    onClick={() => setPickupTime(t)}
                  >
                    {t === "mattina" ? "Mattina" : t === "pomeriggio" ? "Pomeriggio" : "Orario specifico"}
                  </button>
                ))}
              </div>
            )}

            {pickupTime === "specifico" && (
              <input
                className="pnm-input mt-2"
                placeholder="Es. 15:30"
                value={pickupSpecific}
                onChange={e => setPickupSpecific(e.target.value)}
              />
            )}

            <div className="pnm-field mt-2">
              <label className="pnm-label">Nota per il ritiro (opzionale)</label>
              <textarea
                className="pnm-input pnm-textarea"
                rows={2}
                placeholder="Es. Passo domani pomeriggio, grazie!"
                value={form.pickupNote}
                onChange={e => onChange("pickupNote", e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── RIEPILOGO ── */}
      <div className="pnm-summary">
        <span>{product?.name} × {qty}</span>
        <span className="pnm-summary-total">{totalStr}</span>
      </div>
    </UnifiedDrawer>
  );
}
