import { useEffect, useMemo, useRef, useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { createMultiServiceBookingCheckout, fetchAvailableSlots } from "../../api/modules/stripe.api";
import { BOOKING_MAX_ADVANCE_DAYS, BRAND_WHATSAPP } from "../../utils/constants";
import DateTimeField, { toISODateLocal } from "../../components/common/DateTimeField";
import NextSlotBanner from "../../components/common/NextSlotBanner";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";
import { useClosedDays } from "../../hooks/useClosedDays";
import { useNextSlot } from "../../hooks/useNextSlot";
import "./MultiServiceBookingModal.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;
const LASER_KEYWORDS = ["laser", "epilazione", "hiled", "diodo", "luce pulsata"];
const PMU_KEYWORDS = [
  "trucco permanente", "pmu", "microblading", "micropigmentazione",
  "pelo pelo", "labbra permanente", "eyeliner permanente",
];

const needsLaserConsent = title => LASER_KEYWORDS.some(k => title?.toLowerCase().includes(k));
const needsPmuConsent  = title => PMU_KEYWORDS.some(k => title?.toLowerCase().includes(k));

const formatDuration = mins => {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
};

const addMinutes = (timeStr, mins) => {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// MultiServiceBookingFlow = the SAME multi-service flow rendered in both modes;
// chrome injected via `Shell` (UnifiedDrawer desktop / BookingRouteShell route).
export const MultiServiceBookingFlow = ({ Shell, onClose, show = true, services, products = [] }) => {
  const { accessToken, user } = useSelector(state => state.auth);
  const { closedDates, closedWeekdays, isClosed } = useClosedDays();
  const [emptySlotDates, setEmptySlotDates] = useState([]);

  const primaryServiceId = services[0]?.serviceId ?? null;
  const totalDuration   = services.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const servicesTotal   = services.reduce((sum, s) => sum + (s.price || 0), 0);
  const productsTotal   = products.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
  const totalPrice      = servicesTotal + productsTotal;

  const hasLaserConsent = services.some(s => needsLaserConsent(s.name));
  const hasPmuConsent   = services.some(s => needsPmuConsent(s.name));
  const hasConsentStep  = hasLaserConsent || hasPmuConsent;
  const summaryStep     = hasConsentStep ? 5 : 4;

  // ── state ──
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [slot, setSlot] = useState(null);

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [errors, setErrors] = useState({});
  const [paying, setPaying] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const [consentLaser, setConsentLaser] = useState(false);
  const [consentPmu, setConsentPmu] = useState(false);

  // ── next slot ──
  const { nextSlot, loading: nextLoading, notFound: nextNotFound, findNext, findNextAgain } =
    useNextSlot(primaryServiceId);
  const pendingSlotStartRef = useRef(null);

  const maxBookingDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + BOOKING_MAX_ADVANCE_DAYS);
    return d;
  }, []);

  const disabledDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i <= BOOKING_MAX_ADVANCE_DAYS; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = toISODateLocal(d);
      if (iso && isClosed(iso)) dates.push(iso);
    }
    return Array.from(new Set([...dates, ...emptySlotDates]));
  }, [closedDates, closedWeekdays, isClosed, emptySlotDates]);

  // Find next slot on open
  useEffect(() => {
    if (show && primaryServiceId) findNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, primaryServiceId]);

  // Pre-fill customer when reaching step 3
  useEffect(() => {
    if (!show || step !== 3 || !accessToken || !user) return;
    const fullName = user.name && user.surname
      ? `${user.name} ${user.surname}`.trim()
      : (user.name || "").trim();
    setCustomer(prev => ({
      ...prev,
      name:  prev.name.trim()  ? prev.name  : fullName,
      email: prev.email.trim() ? prev.email : (user.email || "").trim(),
      phone: prev.phone.trim() ? prev.phone : (user.phone || "").trim(),
    }));
  }, [show, step, accessToken, user]);

  // Reset on close
  useEffect(() => {
    if (!show) {
      setStep(1);
      setSlot(null);
      setSlots([]);
      setCustomer({ name: "", email: "", phone: "", notes: "" });
      setErrors({});
      setCheckoutError(null);
      setSlotsError(null);
      setConsentLaser(false);
      setConsentPmu(false);
      pendingSlotStartRef.current = null;
    }
  }, [show]);

  // Load slots when entering step 2
  useEffect(() => {
    if (step !== 2 || !totalDuration) return;
    const loadSlots = async () => {
      try {
        setLoadingSlots(true);
        setSlotsError(null);
        const day = date.toLocaleDateString("sv-SE");
        const rawSlots = await fetchAvailableSlots(day, totalDuration);
        const slotObjects = (rawSlots || []).map(s => ({ start: s, end: addMinutes(s, totalDuration) }));
        setSlots(slotObjects);
        if (slotObjects.length === 0) {
          setEmptySlotDates(prev => (prev.includes(day) ? prev : [...prev, day]));
        }
        if (pendingSlotStartRef.current) {
          const auto = slotObjects.find(s => s.start === pendingSlotStartRef.current);
          if (auto) setSlot(auto);
          pendingSlotStartRef.current = null;
        }
      } catch {
        setSlotsError("Impossibile caricare gli slot. Riprova.");
      } finally {
        setLoadingSlots(false);
      }
    };
    loadSlots();
  }, [step, date, totalDuration]);

  const handleCustomerChange = (field, value) => {
    setCustomer(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const err = {};
    if (!customer.name.trim())              err.name  = "Il nome è obbligatorio";
    if (!emailRegex.test(customer.email))   err.email = "Email non valida";
    if (!phoneRegex.test(customer.phone))   err.phone = "Numero di telefono non valido";
    return err;
  };

  const goToNext = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) { setErrors(validationErrors); return; }
    setStep(hasConsentStep ? 4 : summaryStep);
  };

  const handleConfirm = async () => {
    if (paying) return;
    setPaying(true);
    setCheckoutError(null);
    try {
      const day = date.toLocaleDateString("sv-SE");
      const payload = {
        customerName:          customer.name.trim(),
        customerEmail:         customer.email.trim().toLowerCase(),
        customerPhone:         customer.phone.trim(),
        notes:                 customer.notes.trim() || null,
        date:                  day,
        startTime:             slot.start,
        serviceIds:            services.map(s => s.serviceId),
        totalDurationMinutes:  totalDuration,
        consentLaser,
        consentPmu,
        ...(products.length > 0 && {
          products: products.map(p => ({
            productId:  p.productId,
            quantity:   p.quantity || 1,
            pickupDate: day,
          })),
        }),
      };
      const { url } = await createMultiServiceBookingCheckout(payload);
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err.message || "Errore durante la prenotazione. Riprova.");
      setPaying(false);
    }
  };

  // ── topSlot: compact cart header + step indicator ──
  const topSlot = (
    <>
      <div className="msb-cart-header">
        <div className="msb-cart-header__pills">
          {services.map(s => (
            <span key={s.id} className="msb-cart-header__pill">{s.name}</span>
          ))}
          {products.length > 0 && (
            <span className="msb-cart-header__pill msb-cart-header__pill--product">
              +{products.length} prodott{products.length === 1 ? "o" : "i"}
            </span>
          )}
        </div>
        <div className="msb-cart-header__meta">
          {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
          <span className="msb-cart-header__price">
            {totalPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
          </span>
        </div>
      </div>

      <div className="bm-steps">
        {Array.from({ length: summaryStep }, (_, i) => i + 1).map(s => (
          <div key={s} className={`bm-step ${step === s ? "active" : step > s ? "done" : ""}`}>
            <div className="bm-step__dot">{step > s ? "✓" : s}</div>
            <span className="bm-step__label">
              {s === 1 ? "Data"
               : s === 2 ? "Orario"
               : s === 3 ? "Dati"
               : hasConsentStep && s === 4 ? "Consenso"
               : "Riepilogo"}
            </span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <Shell
      show={show}
      layout="side"
      onHide={onClose}
      eyebrow="PRENOTAZIONE ✦"
      title={`${services.length} trattament${services.length === 1 ? "o" : "i"} · unica seduta`}
      subtitle={null}
      topSlot={topSlot}
      size="sm"
    >
      {/* ── STEP 1: Data ── */}
      {step === 1 && (
        <div className="bm-step-content">
          <div className="bm-step1-grid">
            <NextSlotBanner
              slot={nextSlot}
              loading={nextLoading}
              notFound={nextNotFound}
              onFind={findNext}
              onNext={findNextAgain}
              onSelect={bannerSlot => {
                const d = new Date(bannerSlot.date + "T12:00:00");
                if (!Number.isNaN(d.getTime())) {
                  setDate(d);
                  pendingSlotStartRef.current = bannerSlot.startTime;
                  setStep(2);
                }
              }}
            />
            <div className="bm-or-divider"><span>oppure scegli una data</span></div>
            <DateTimeField
              variant="inline"
              mode="date"
              value={toISODateLocal(date)}
              onChange={iso => {
                const d = new Date(`${iso}T12:00:00`);
                if (!Number.isNaN(d.getTime())) { setDate(d); setSlot(null); }
              }}
              minDate={new Date()}
              maxDate={maxBookingDate}
              disabledDates={disabledDates}
              placeholder="Scegli un giorno"
            />
          </div>
          <div className="bm-nav">
            <span />
            <button className="bm-btn bm-btn--primary" type="button" onClick={() => setStep(2)}>
              Scegli orario →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Orario ── */}
      {step === 2 && (
        <div className="bm-step-content">
          <div className="bm-date-recap">
            📅{" "}
            {date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          {loadingSlots && (
            <div className="bm-loading">
              <Spinner size="sm" animation="border" /> Carico slot…
            </div>
          )}
          {slotsError && <div className="bm-alert">{slotsError}</div>}
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
          {slots.length === 0 && !loadingSlots && !slotsError && (
            <p className="bm-empty">Nessuno slot disponibile. Prova un altro giorno.</p>
          )}
          <div className="bm-nav">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={() => { setSlot(null); setStep(1); }}>
              ← Indietro
            </button>
            <button className="bm-btn bm-btn--primary" type="button" onClick={() => setStep(3)} disabled={!slot}>
              Continua →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Dati ── */}
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
                placeholder="Allergie, preferenze, richieste particolari…"
                className="bm-input"
                maxLength={500}
              />
            </Form.Group>
          </Form>
          <div className="bm-nav">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={() => setStep(2)}>← Indietro</button>
            <button className="bm-btn bm-btn--primary" type="button" onClick={goToNext}>
              {hasConsentStep ? "Consenso →" : "Riepilogo →"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Consenso (opzionale) ── */}
      {step === 4 && hasConsentStep && (
        <div className="bm-step-content bm-consent">
          <div className="bm-consent__header">
            <span className="bm-consent__icon">📋</span>
            <h3 className="bm-consent__title">Informativa e consenso</h3>
            <p className="bm-consent__subtitle">
              Leggi le informazioni sul trattamento e conferma la presa visione.
            </p>
          </div>

          {hasLaserConsent && (
            <div className="bm-consent__box">
              <h4 className="bm-consent__box-title">Epilazione laser</h4>
              <div className="bm-consent__text">
                <p>Il trattamento utilizza laser a diodo 818nm (fototermolisi selettiva). Sono necessarie mediamente 10-12 sedute.</p>
                <p><strong>Controindicazioni principali:</strong> farmaci fotosensibilizzanti, malattie autoimmuni, lesioni cutanee, gravidanza/allattamento, esposizione solare nei 3/4 giorni precedenti/successivi.</p>
                <p className="bm-consent__note">⚠️ Alla prima seduta firmerai il consenso informato completo in studio.</p>
              </div>
              <label className="bm-consent__check">
                <input type="checkbox" checked={consentLaser} onChange={e => setConsentLaser(e.target.checked)} />
                <span>Ho letto le informazioni, dichiaro di non avere controindicazioni e sono consapevole che firmero il documento completo in studio.</span>
              </label>
            </div>
          )}

          {hasPmuConsent && (
            <div className="bm-consent__box">
              <h4 className="bm-consent__box-title">Trucco permanente (PMU)</h4>
              <div className="bm-consent__text">
                <p>Tecnica di micropigmentazione intradermica con pigmenti certificati. Tempi di guarigione: 7-14 giorni.</p>
                <p><strong>Controindicazioni principali:</strong> gravidanza/allattamento, diabete, coagulopatie, allergie a pigmenti/anestetici, malattie cutanee nella zona interessata, cicatrici recenti o cheloidi.</p>
                <p className="bm-consent__note">⚠️ Alla prima seduta firmerai il modulo di consenso completo in studio.</p>
              </div>
              <label className="bm-consent__check">
                <input type="checkbox" checked={consentPmu} onChange={e => setConsentPmu(e.target.checked)} />
                <span>Ho letto le informazioni, dichiaro di non avere controindicazioni e sono consapevole che firmero il documento completo in studio.</span>
              </label>
            </div>
          )}

          <div className="bm-nav">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={() => setStep(3)}>← Indietro</button>
            <button
              className="bm-btn bm-btn--primary"
              type="button"
              onClick={() => setStep(summaryStep)}
              disabled={(hasLaserConsent && !consentLaser) || (hasPmuConsent && !consentPmu)}
            >
              Continua →
            </button>
          </div>
        </div>
      )}

      {/* ── Riepilogo ── */}
      {step === summaryStep && (
        <div className="bm-step-content">
          <div className="bm-summary">
            <div className="bm-summary__row">
              <span>Data</span>
              <strong>{date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long" })}</strong>
            </div>
            <div className="bm-summary__row">
              <span>Orario</span>
              <strong>{slot?.start} – {slot?.end}</strong>
            </div>
            <div className="bm-summary__row">
              <span>Durata totale</span>
              <strong>{formatDuration(totalDuration)}</strong>
            </div>
            <div className="bm-summary__divider" />
            {services.map(s => (
              <div key={s.id} className="bm-summary__row">
                <span>{s.name}</span>
                <strong>{s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</strong>
              </div>
            ))}
            {products.length > 0 && (
              <>
                <div className="bm-summary__divider" />
                {products.map(p => (
                  <div key={p.id} className="bm-summary__row">
                    <span>
                      {p.name} ×{p.quantity || 1}{" "}
                      <span style={{ fontSize: "0.72rem", color: "#b8976a" }}>ritiro stesso giorno</span>
                    </span>
                    <strong>
                      {(p.price * (p.quantity || 1)).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                    </strong>
                  </div>
                ))}
              </>
            )}
            <div className="bm-summary__divider" />
            <div className="bm-summary__row">
              <span style={{ fontWeight: 600, color: "#2e2118" }}>Totale</span>
              <strong style={{ fontSize: "1.1rem" }}>
                {totalPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </strong>
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
            {(consentLaser || consentPmu) && (
              <div className="bm-summary__consent-note">
                📋 Ricordati di firmare il consenso informato completo in studio alla prima seduta.
              </div>
            )}
          </div>

          {checkoutError && <div className="bm-alert" style={{ marginTop: "1rem" }}>{checkoutError}</div>}

          <div className="bm-nav bm-nav--col">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={() => setStep(hasConsentStep ? 4 : 3)}>
              ← Modifica
            </button>
            <button className="bm-btn bm-btn--cta" type="button" onClick={handleConfirm} disabled={paying}>
              {paying
                ? <><Spinner size="sm" animation="border" /> Reindirizzamento…</>
                : "💳 Paga ora con carta"}
            </button>
          </div>
          <div className="bm-whatsapp-footer">
            <a
              href={`https://wa.me/${BRAND_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bm-whatsapp-link"
            >
              Hai bisogno di aiuto? → WhatsApp
            </a>
          </div>
        </div>
      )}
    </Shell>
  );
};

// Desktop wrapper — public API unchanged.
export default function MultiServiceBookingModal({ show, onHide, ...props }) {
  return <MultiServiceBookingFlow Shell={UnifiedDrawer} show={show} onClose={onHide} {...props} />;
}
