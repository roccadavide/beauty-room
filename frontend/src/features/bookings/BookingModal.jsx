import { useEffect, useMemo, useRef, useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { fetchAvailabilities } from "../../api/modules/availabilities.api";
import {
  createBookingCheckoutSessionAuth,
  createBookingCheckoutSessionGuest,
  createBookingPayInStore,
} from "../../api/modules/stripe.api";
import { fetchCancellationPolicy } from "../../api/modules/users.api";
import { BRAND_WHATSAPP } from "../../utils/constants";
import DateTimeField, { toISODateLocal } from "../../components/common/DateTimeField";
import NextSlotBanner from "../../components/common/NextSlotBanner";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";
import WaitlistModal from "../../components/common/WaitlistModal";
import { useClosedDays } from "../../hooks/useClosedDays";
import { useNextSlot } from "../../hooks/useNextSlot";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;
const LASER_KEYWORDS = ["laser", "epilazione", "hiled", "diodo", "luce pulsata"];
const PMU_KEYWORDS = [
  "trucco permanente",
  "pmu",
  "microblading",
  "micropigmentazione",
  "pelo pelo",
  "labbra permanente",
  "eyeliner permanente",
];

const needsLaserConsent = title => LASER_KEYWORDS.some(k => title?.toLowerCase().includes(k));
const needsPmuConsent = title => PMU_KEYWORDS.some(k => title?.toLowerCase().includes(k));

// FIX-2: initialOptionId viene passato da ServiceDetails quando il servizio ha opzioni
const BookingModal = ({
  show,
  onHide,
  service,
  initialOptionId = null,
  initialOption = null,
  promoPrice = null,
  promotionId = null,
  promoProducts = [],
  prefill = null,
}) => {
  const { accessToken, user } = useSelector(state => state.auth);

  const { closedDates, closedWeekdays, isClosed } = useClosedDays();
  const [emptySlotDates, setEmptySlotDates] = useState([]);
  const disabledDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = toISODateLocal(d);
      if (iso && isClosed(iso)) dates.push(iso);
    }
    return Array.from(new Set([...dates, ...emptySlotDates]));
  }, [closedDates, closedWeekdays, isClosed, emptySlotDates]);

  const { nextSlot, loading: nextLoading, notFound: nextNotFound, findNext, findNextAgain } =
    useNextSlot(service?.serviceId);
  // Ref used to auto-select a slot after slots are loaded (set by NextSlotBanner → onSelect)
  const pendingSlotStartRef = useRef(null);

  // Cerca il prossimo slot non appena il modale si apre con un servizio valido
  useEffect(() => {
    if (show && service?.serviceId) findNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, service?.serviceId]);

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
  const [cancellationHours, setCancellationHours] = useState(null);
  const [waitlistSlot, setWaitlistSlot] = useState(null);
  const [consentLaser, setConsentLaser] = useState(false);
  const [consentPmu, setConsentPmu] = useState(false);
  // Usa consentRequired dal backend (derivato da categoria) oppure keyword matching come fallback
  const hasConsentStep = service?.consentRequired === true || needsLaserConsent(service?.title) || needsPmuConsent(service?.title);
  // Il blocco PMU si mostra se consentRequired=true (qualunque categoria PMU) o keyword match
  const showPmuConsent = service?.consentRequired === true || needsPmuConsent(service?.title);
  const summaryStep = hasConsentStep ? 5 : 4;
  const effectiveDuration = initialOption?.durationMin ?? service?.durationMin;

  // Fetch cancellation policy on first open
  useEffect(() => {
    if (!show || cancellationHours !== null) return;
    fetchCancellationPolicy()
      .then(d => setCancellationHours(d.cancellationHoursLimit ?? 24))
      .catch(() => setCancellationHours(24));
  }, [show, cancellationHours]);

  // Apply prefill from waitlist deep link
  useEffect(() => {
    if (!show || !prefill) return;
    if (prefill.date) {
      const parsed = new Date(prefill.date);
      if (!Number.isNaN(parsed.getTime())) setDate(parsed);
    }
    setCustomer(prev => ({
      ...prev,
      name:  prefill.customerName  || prev.name,
      email: prefill.customerEmail || prev.email,
      phone: prefill.customerPhone || prev.phone,
    }));
    setStep(2);
  }, [show, prefill]);

  const reset = () => {
    setStep(1);
    setSlot(null);
    setSlots([]);
    setCustomer({ name: "", email: "", phone: "", notes: "" });
    setErrors({});
    setError(null);
    setPaying(false);
    setWaitlistSlot(null);
    setConsentLaser(false);
    setConsentPmu(false);
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
          const loaded = data.slots || [];
          setSlots(loaded);
          if (loaded.length === 0) {
            setEmptySlotDates(prev => (prev.includes(day) ? prev : [...prev, day]));
          }

          // Auto-select slot pre-scelto dal NextSlotBanner
          if (pendingSlotStartRef.current) {
            const autoSlot = loaded.find(
              s => s.start === pendingSlotStartRef.current && s.available !== false
            );
            if (autoSlot) setSlot(autoSlot);
            pendingSlotStartRef.current = null;
          }
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
    setStep(hasConsentStep ? 4 : summaryStep);
  };

  const buildPayload = day => ({
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    notes: customer.notes,
    startTime: `${day}T${slot.start}:00`,
    serviceId: service.serviceId,
    serviceOptionId: initialOptionId,
    ...(promotionId != null && { promotionId: String(promotionId) }),
    ...(promoPrice != null && promoPrice > 0 && {
      promoPrice: parseFloat(promoPrice.toFixed(2)),
    }),
    consentLaser: consentLaser,
    consentPmu: consentPmu,
  });

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
      const payload = buildPayload(day);

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

  const confirmPayInStore = async () => {
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
      const payload = buildPayload(day);
      await createBookingPayInStore(payload);
      onHide();
      reset();
      window.location.href = "/prenotazione-confermata?payInStore=1";
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

  const promoOriginal =
    promoPrice != null
      ? (Number(service?.price || 0) + promoProducts.reduce((sum, p) => sum + Number(p?.price || 0), 0))
      : null;

  const metaSubtitle = (service?.durationMin || service?.price != null) ? (
    <div className="bm-header__meta">
      {effectiveDuration && <span className="bm-meta-pill">⏱ {effectiveDuration} min</span>}
      {promoPrice != null ? (
        <>
          <span className="bm-meta-pill bm-meta-pill--orig">
            {service.price?.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
          </span>
          <span className="bm-meta-pill bm-meta-pill--promo">
            {promoPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
          </span>
        </>
      ) : service.price != null ? (
        <span className="bm-meta-pill">
          {service.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
        </span>
      ) : null}
      {promoProducts.length > 0 && (
        <div className="bm-meta-pill bm-meta-pill--product">
          🎁 {promoProducts.map(p => p.name).join(", ")} incluso
        </div>
      )}
    </div>
  ) : null;

  const stepsSlot = (
    <div className="bm-steps">
      {Array.from({ length: summaryStep }, (_, i) => i + 1).map(s => (
        <div key={s} className={`bm-step ${step === s ? "active" : step > s ? "done" : ""}`}>
          <div className="bm-step__dot">{step > s ? "✓" : s}</div>
          <span className="bm-step__label">
            {s === 1
              ? "Data"
              : s === 2
                ? "Orario"
                : s === 3
                  ? "Dati"
                  : hasConsentStep && s === 4
                    ? "Consenso"
                    : "Riepilogo"}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <>
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
              if (!Number.isNaN(d.getTime())) {
                setDate(d);
                setSlot(null);
              }
            }}
            minDate={new Date()}
            disabledDates={disabledDates}
            placeholder="Scegli un giorno"
          />
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
            {slots.map(s => {
              const isOccupied = s.available === false;
              return (
                <button
                  key={s.start}
                  type="button"
                  className={`bm-slot ${slot?.start === s.start ? "is-selected" : ""} ${isOccupied ? "bm-slot--occupied" : ""}`}
                  onClick={() => {
                    if (isOccupied) setWaitlistSlot(s);
                    else setSlot(s);
                  }}
                  title={isOccupied ? "Slot occupato — clicca per lista d'attesa" : undefined}
                >
                  {isOccupied ? "🔒 " : ""}{s.start}
                  <span className="bm-slot__end">– {s.end}</span>
                  {isOccupied && <span className="bm-slot__waitlist-hint">Lista d'attesa</span>}
                </button>
              );
            })}
          </div>
          {slots.length === 0 && !loadingSlots && (
            <p className="bm-empty">Nessuno slot disponibile. Prova un altro giorno.</p>
          )}
          <div className="bm-nav">
            <button
              className="bm-btn bm-btn--ghost"
              type="button"
              onClick={() => {
                setSlot(null);
                setStep(1);
              }}
            >
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
              {hasConsentStep ? "Consenso →" : "Riepilogo →"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && hasConsentStep && (
        <div className="bm-step-content bm-consent">
          <div className="bm-consent__header">
            <span className="bm-consent__icon">📋</span>
            <h3 className="bm-consent__title">Informativa e consenso</h3>
            <p className="bm-consent__subtitle">
              Leggi le informazioni sul trattamento e conferma la presa visione.
            </p>
          </div>

          {needsLaserConsent(service?.title) && (
            <div className="bm-consent__box">
              <h4 className="bm-consent__box-title">Epilazione laser</h4>
              <div className="bm-consent__text">
                <p>Il trattamento utilizza laser a diodo 818nm (fototermolisi selettiva). Sono necessarie mediamente 10-12 sedute.</p>
                <p><strong>Controindicazioni principali:</strong> farmaci fotosensibilizzanti, malattie autoimmuni, lesioni cutanee, gravidanza/allattamento, esposizione solare nei 3/4 giorni precedenti/successivi.</p>
                <p className="bm-consent__note">
                  ⚠️ Alla prima seduta firmerai il consenso informato completo in studio.
                </p>
              </div>
              <label className="bm-consent__check">
                <input type="checkbox" checked={consentLaser} onChange={e => setConsentLaser(e.target.checked)} />
                <span>Ho letto le informazioni, dichiaro di non avere controindicazioni e sono consapevole che firmero il documento completo in studio.</span>
              </label>
            </div>
          )}

          {showPmuConsent && (
            <div className="bm-consent__box">
              <h4 className="bm-consent__box-title">Trucco permanente (PMU)</h4>
              <div className="bm-consent__text">
                <p>Tecnica di micropigmentazione intradermica con pigmenti certificati. Tempi di guarigione: 7-14 giorni.</p>
                <p><strong>Controindicazioni principali:</strong> gravidanza/allattamento, diabete, coagulopatie, allergie a pigmenti/anestetici, malattie cutanee nella zona interessata, cicatrici recenti o cheloidi.</p>
                <p className="bm-consent__note">
                  ⚠️ Alla prima seduta firmerai il modulo di consenso completo in studio.
                </p>
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
              disabled={(needsLaserConsent(service?.title) && !consentLaser) || (showPmuConsent && !consentPmu)}
            >
              Continua →
            </button>
          </div>
        </div>
      )}

      {step === summaryStep && (
        <div className="bm-step-content">
          <div className="bm-summary">
            <div className="bm-summary__row">
              <span>Servizio</span>
              <strong>{service?.title}</strong>
            </div>
            <div className="bm-summary__row">
              <span>Durata</span>
              <strong>{effectiveDuration} min</strong>
            </div>
            {promoPrice != null && promoOriginal != null ? (
              <>
                <div className="bm-summary__row">
                  <span>{service?.title}</span>
                  <strong>
                    {service?.price?.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                  </strong>
                </div>

                {promoProducts.map(p => (
                  <div key={p.productId} className="bm-summary__row">
                    <span>{p.name} <span style={{ fontSize: "0.72rem", color: "#b8976a" }}>incluso</span></span>
                    <strong>
                      {Number(p.price).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                    </strong>
                  </div>
                ))}

                <div className="bm-summary__row" style={{ marginTop: "4px" }}>
                  <span style={{ fontWeight: 600, color: "#2e2118" }}>Totale listino</span>
                  <strong style={{ textDecoration: "line-through", color: "#b0a09a" }}>
                    {promoOriginal.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                  </strong>
                </div>

                <div className="bm-summary__divider" />

                <div className="bm-summary__row">
                  <span style={{ fontWeight: 700, color: "#2e2118" }}>Prezzo promozione</span>
                  <strong style={{ fontSize: "1.1rem", color: "#2e2118" }}>
                    {promoPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                  </strong>
                </div>

                <div className="bm-summary__row">
                  <span style={{ fontSize: "0.8rem", color: "#8c6d3f" }}>Risparmi</span>
                  <span style={{
                    fontSize: "0.78rem",
                    background: "rgba(184,151,106,0.13)",
                    color: "#8c6d3f",
                    padding: "0.15rem 0.55rem",
                    borderRadius: "999px",
                    fontWeight: 700
                  }}>
                    {(promoOriginal - promoPrice).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                  </span>
                </div>
              </>
            ) : (
              <div className="bm-summary__row">
                <span>Prezzo</span>
                <strong>
                  {service?.price?.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                </strong>
              </div>
            )}
            {promoProducts.length > 0 && (
              <>
                <div className="bm-summary__divider" />
                <div className="bm-summary__row bm-summary__row--highlight">
                  <span>Prodotto incluso</span>
                  <strong>{promoProducts.map(p => p.name).join(", ")}</strong>
                </div>
                <div className="bm-summary__row">
                  <span style={{ fontSize: "0.78rem", color: "#9c8880" }}>Consegna</span>
                  <span style={{ fontSize: "0.78rem", color: "#9c8880", textAlign: "right" }}>
                    Il giorno del trattamento
                  </span>
                </div>
              </>
            )}
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
            {(consentLaser || consentPmu) && (
              <div className="bm-summary__consent-note">
                📋 Ricordati di firmare il consenso informato completo in studio alla prima seduta.
              </div>
            )}
          </div>
          <div className="bm-nav bm-nav--col">
            <button className="bm-btn bm-btn--ghost" type="button" onClick={() => setStep(hasConsentStep ? 4 : 3)}>
              ← Modifica
            </button>
            {/* FIX-9: disabled durante redirect Stripe */}
            <button className="bm-btn bm-btn--cta" type="button" onClick={confirm} disabled={paying}>
              {paying ? <><Spinner size="sm" animation="border" /> Reindirizzamento…</> : "💳 Paga ora con carta"}
            </button>
            {user?.isVerified && !paying && (
              <button className="bm-btn bm-btn--pay-in-store" type="button" onClick={confirmPayInStore}>
                🏠 Paga in loco (Cliente di Fiducia)
              </button>
            )}
          </div>
          {cancellationHours !== null && (
            <p className="bm-policy-note">
              In caso di imprevisto puoi spostare o annullare contattando Michela su WhatsApp entro{" "}
              <strong>{cancellationHours} ore</strong> dall&apos;appuntamento. I rimborsi vengono elaborati entro 5-7 giorni lavorativi.
            </p>
          )}
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
    </UnifiedDrawer>

    <WaitlistModal
      show={!!waitlistSlot}
      onHide={() => setWaitlistSlot(null)}
      service={service}
      date={date}
      slot={waitlistSlot}
    />
    </>
  );
};

export default BookingModal;
