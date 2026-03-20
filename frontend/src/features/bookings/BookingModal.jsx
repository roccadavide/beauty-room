// Migrated to UnifiedDrawer — 2026-03-20 — see _unified-drawer.css
import { useEffect, useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { fetchAvailabilities } from "../../api/modules/availabilities.api";
import { createBookingCheckoutSessionAuth, createBookingCheckoutSessionGuest } from "../../api/modules/stripe.api";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;

function BookingCalendar({ selected, onChange, minDate }) {
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDOW = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (firstDOW + 6) % 7; // Lun primo

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const isSelected = d => selected.getDate() === d && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear;

  const isToday = d => {
    const dt = new Date(viewYear, viewMonth, d);
    return dt.toDateString() === new Date().toDateString();
  };

  const isPast = d => {
    const dt = new Date(viewYear, viewMonth, d);
    dt.setHours(0, 0, 0, 0);
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    return dt < min;
  };

  const DOW_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bc-calendar">
      <div className="bc-header">
        <button className="bc-nav-btn" onClick={prevMonth} type="button">
          ‹
        </button>
        <span className="bc-month-label">{monthName}</span>
        <button className="bc-nav-btn" onClick={nextMonth} type="button">
          ›
        </button>
      </div>

      <div className="bc-grid">
        {DOW_LABELS.map(l => (
          <div key={l} className="bc-dow">
            {l}
          </div>
        ))}
        {cells.map((d, i) => {
          const classes = ["bc-day"];
          if (d === null) classes.push("bc-day--empty");
          if (d && isSelected(d)) classes.push("bc-day--selected");
          if (d && isToday(d)) classes.push("bc-day--today");
          if (d && isPast(d)) classes.push("bc-day--past");
          return (
            <div
              key={i}
              className={classes.join(" ")}
              onClick={() => {
                if (!d || isPast(d)) return;
                onChange(new Date(viewYear, viewMonth, d));
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// FIX-2: initialOptionId viene passato da ServiceDetails quando il servizio ha opzioni
const BookingModal = ({ show, onHide, service, initialOptionId = null }) => {
  const { accessToken, user } = useSelector(state => state.auth);

  const [step, setStep] = useState(1);
  const [date, setDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);

  const [slot, setSlot] = useState(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [errors, setErrors] = useState({});
  // FIX-9: blocca doppio click su "Vai al pagamento"
  const [paying, setPaying] = useState(false);

  const reset = () => {
    setStep(1);
    setSlot(null);
    setSlots([]);
    setCustomer({ name: "", email: "", phone: "", notes: "" });
    setErrors({});
    setError(null);
    setPaying(false);
  };

  useEffect(() => {
    if (step === 2 && service) {
      const loadSlots = async () => {
        try {
          setLoadingSlots(true);
          setError(null);

          if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            throw new Error("Data non valida selezionata.");
          }

          const day = date.toLocaleDateString("sv-SE");
          const data = await fetchAvailabilities(service.serviceId, day);

          setSlots(data.slots || []);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoadingSlots(false);
        }
      };

      loadSlots();
    }
  }, [step, service, date]);


  const handleCustomerChange = (field, value) => {
    setCustomer(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const err = {};
    if (!customer.name.trim()) err.name = "Il nome è obbligatorio";
    if (!emailRegex.test(customer.email)) err.email = "Email non valida";
    if (!phoneRegex.test(customer.phone)) err.phone = "Numero di telefono non valido";
    return err;
  };

  const goToSummary = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setStep(4);
  };

  const confirm = async () => {
    // FIX-9: prevenzione doppio click
    if (paying) return;
    setPaying(true);
    try {
      setError(null);

      if (!service?.serviceId) throw new Error("Servizio non valido.");
      if (!slot?.start) throw new Error("Seleziona uno slot.");

      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new Error("Data non valida selezionata.");
      }

      const day = date.toLocaleDateString("sv-SE");

      const payload = {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        notes: customer.notes,
        startTime: `${day}T${slot.start}:00`,
        serviceId: service.serviceId,
        serviceOptionId: initialOptionId, // FIX-2: passato da ServiceDetails
      };

      // NIENTE token param: ci pensa httpClient/interceptor
      const res = accessToken ? await createBookingCheckoutSessionAuth(payload) : await createBookingCheckoutSessionGuest(payload);

      onHide();
      reset();
      window.location.href = res.url;
    } catch (err) {
      setError(err.message || "Si è verificato un errore durante la prenotazione. Riprova più tardi.");
      setPaying(false);
    }
  };

  useEffect(() => {
    if (!show || step !== 3) return;
    if (!accessToken || !user) return;

    const fullName = user.name && user.surname ? `${user.name} ${user.surname}`.trim() : (user.name || user.fullName || "").trim();

    setCustomer(prev => ({
      ...prev,
      name: prev.name.trim() ? prev.name : fullName,
      email: prev.email.trim() ? prev.email : (user.email || "").trim(),
      phone: prev.phone.trim() ? prev.phone : (user.phone || user.telefono || "").trim(),
    }));
  }, [show, step, accessToken, user]);

  const handleClose = () => {
    onHide();
    reset();
  };

  const metaSubtitle = (service?.durationMin || service?.price != null) ? (
    <div className="bm-header__meta">
      {service.durationMin && <span className="bm-meta-pill">⏱ {service.durationMin} min</span>}
      {service.price != null && (
        <span className="bm-meta-pill">{service.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
      )}
    </div>
  ) : null;

  const stepsSlot = (
    <div className="bm-steps">
      {[1, 2, 3, 4].map(s => (
        <div key={s} className={`bm-step ${step === s ? "active" : step > s ? "done" : ""}`}>
          <div className="bm-step__dot">{step > s ? "✓" : s}</div>
          <span className="bm-step__label">
            {s === 1 ? "Data" : s === 2 ? "Orario" : s === 3 ? "Dati" : "Riepilogo"}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <UnifiedDrawer
      show={show}
      onHide={handleClose}
      title={service?.title}
      subtitle={metaSubtitle}
      topSlot={stepsSlot}
      size="sm"
    >
      {error && <div className="bm-alert">{error}</div>}

      {step === 1 && (
        <div className="bm-step-content">
          <BookingCalendar selected={date} onChange={setDate} minDate={new Date()} />
          <div className="bm-nav">
            <span />
            <button className="bm-btn bm-btn--primary" type="button" onClick={() => setStep(2)}>
              Scegli orario →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bm-step-content">
          <div className="bm-date-recap">
            📅{" "}
            {date.toLocaleDateString("it-IT", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          {loadingSlots && (
            <div className="bm-loading">
              <Spinner size="sm" animation="border" /> Carico slot…
            </div>
          )}
          <div className="bm-slots">
            {slots.map(s => (
              <button
                key={s.start}
                type="button"
                className={`bm-slot ${slot?.start === s.start ? "is-selected" : ""}`}
                onClick={() => setSlot(s)}
              >
                {s.start}
                <span className="bm-slot__end">– {s.end}</span>
              </button>
            ))}
          </div>
          {slots.length === 0 && !loadingSlots && (
            <p className="bm-empty">Nessuno slot disponibile. Prova un altro giorno.</p>
          )}
          <div className="bm-nav">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={() => setStep(1)}>
              ← Indietro
            </button>
            <button className="bm-btn bm-btn--primary" type="button" onClick={() => setStep(3)} disabled={!slot}>
              Continua →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bm-step-content">
          <Form className="bm-form">
            <Form.Group className="bm-form-group">
              <Form.Label>Nome e Cognome *</Form.Label>
              <Form.Control
                value={customer.name}
                onChange={e => handleCustomerChange("name", e.target.value)}
                isInvalid={!!errors.name}
                placeholder="Es. Mario Rossi"
                className="bm-input"
              />
              <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="bm-form-group">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                value={customer.email}
                onChange={e => handleCustomerChange("email", e.target.value)}
                isInvalid={!!errors.email}
                placeholder="nome@email.com"
                className="bm-input"
              />
              <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="bm-form-group">
              <Form.Label>Telefono *</Form.Label>
              <Form.Control
                value={customer.phone}
                onChange={e => handleCustomerChange("phone", e.target.value)}
                isInvalid={!!errors.phone}
                placeholder="+39 333 1234567"
                className="bm-input"
              />
              <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="bm-form-group">
              <Form.Label>Note (opzionale)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={customer.notes}
                onChange={e => handleCustomerChange("notes", e.target.value)}
                placeholder="Allergie, preferenze, domande…"
                className="bm-input"
              />
            </Form.Group>
          </Form>
          <div className="bm-nav">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={() => setStep(2)}>
              ← Indietro
            </button>
            <button className="bm-btn bm-btn--primary" type="button" onClick={goToSummary}>
              Riepilogo →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bm-step-content">
          <div className="bm-summary">
            <div className="bm-summary__row">
              <span>Servizio</span>
              <strong>{service?.title}</strong>
            </div>
            <div className="bm-summary__row">
              <span>Durata</span>
              <strong>{service?.durationMin} min</strong>
            </div>
            <div className="bm-summary__row">
              <span>Prezzo</span>
              <strong>{service?.price?.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</strong>
            </div>
            <div className="bm-summary__divider" />
            <div className="bm-summary__row">
              <span>Data</span>
              <strong>{date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long" })}</strong>
            </div>
            <div className="bm-summary__row">
              <span>Orario</span>
              <strong>{slot?.start} – {slot?.end}</strong>
            </div>
            <div className="bm-summary__divider" />
            <div className="bm-summary__row">
              <span>Cliente</span>
              <strong>{customer.name}</strong>
            </div>
            <div className="bm-summary__row">
              <span>Email</span>
              <strong>{customer.email}</strong>
            </div>
            <div className="bm-summary__row">
              <span>Telefono</span>
              <strong>{customer.phone}</strong>
            </div>
            {customer.notes && (
              <div className="bm-summary__row">
                <span>Note</span>
                <strong>{customer.notes}</strong>
              </div>
            )}
          </div>
          <div className="bm-nav">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={() => setStep(3)}>
              ← Modifica
            </button>
            {/* FIX-9: disabled durante redirect Stripe */}
            <button className="bm-btn bm-btn--cta" type="button" onClick={confirm} disabled={paying}>
              {paying ? <><Spinner size="sm" animation="border" /> Reindirizzamento…</> : "💳 Vai al pagamento"}
            </button>
          </div>
        </div>
      )}
    </UnifiedDrawer>
  );
};

export default BookingModal;
