import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useSearchParams, Link } from "react-router-dom";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { fetchBookingSummary } from "../../api/modules/stripe.api";
import { fetchServiceById } from "../../api/modules/services.api";
import { clearCart } from "../cart/slices/cart.slice";
import { BRAND_WHATSAPP } from "../../utils/constants";
import "../../styles/pages/_confirmation.css";
import SEO from "../../components/common/SEO";

const MAX_POLL = 90;
const TIMEOUT_MSG = "La verifica sta richiedendo più tempo del previsto. Controlla lo stato nel tuo profilo tra qualche minuto.";

const fmtDate = isoLike => {
  if (!isoLike) return "–";
  let d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) {
    const fixed = /Z$|[+-]\d{2}:\d{2}$/.test(isoLike) ? isoLike : `${isoLike}Z`;
    d = new Date(fixed);
  }
  if (Number.isNaN(d.getTime())) return isoLike;
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

/* ── Sub-components ─────────────────────────────── */

function StatusBadge({ paid }) {
  return (
    <span className={`conf-badge ${paid ? "conf-badge--paid" : "conf-badge--pending"}`}>
      <span className="conf-badge__dot" />
      {paid ? "Prenotazione confermata" : "In attesa di conferma"}
    </span>
  );
}

function Steps({ items }) {
  const nodes = [];
  items.forEach((s, i) => {
    if (i > 0) {
      nodes.push(<div key={`line-${i}`} className={`conf-step-line${items[i - 1].done ? " conf-step-line--done" : ""}`} />);
    }
    nodes.push(
      <div key={s.label} className="conf-step">
        <div className={`conf-step__dot${s.done ? " conf-step__dot--done" : s.active ? " conf-step__dot--active" : ""}`}>{s.done ? "✓" : i + 1}</div>
        <span className={`conf-step__label${s.done ? " conf-step__label--done" : s.active ? " conf-step__label--active" : ""}`}>{s.label}</span>
      </div>,
    );
  });
  return <div className="conf-steps">{nodes}</div>;
}

/* ── Main component ─────────────────────────────── */

export default function BookingConfirmation() {
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const payInStore = params.get("payInStore") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [service, setService] = useState(null);
  // Audit K / Fix 23: definitive rejection (slot taken → refunded). Holds the backend `outcome`
  // variant ("REJECTED" | "REJECTED_REFUND_PENDING") so we stop polling and show a clear result.
  const [rejected, setRejected] = useState(null);

  /* pay-in-store: no Stripe session needed */
  useEffect(() => {
    if (payInStore) {
      setLoading(false);
      return;
    }
  }, [payInStore]);

  /* polling */
  useEffect(() => {
    if (payInStore) return; // handled above
    if (!sessionId) {
      setError("Session ID mancante.");
      setLoading(false);
      return;
    }

    let alive = true;
    let stopped = false;
    let iv = null;
    let attempts = 0;

    const tick = async () => {
      if (!alive || stopped) return;

      if (attempts >= MAX_POLL) {
        stopped = true;
        clearInterval(iv);
        setError(TIMEOUT_MSG);
        setLoading(false);
        return;
      }
      attempts += 1;

      try {
        const data = await fetchBookingSummary(sessionId);
        if (!alive || stopped) return;

        if (data?.paymentStatus?.startsWith("ERROR")) {
          setError(data.message || "Impossibile caricare la prenotazione.");
          setLoading(false);
          stopped = true;
          clearInterval(iv);
          return;
        }

        setSummary(data);
        setLoading(false);

        // Audit K / Fix 23: the paid booking was rejected (slot taken) and refunded. Resolve to a
        // definitive outcome immediately — never wait out the timeout, never show a (false) confirmed UI.
        if (data?.outcome === "REJECTED" || data?.outcome === "REJECTED_REFUND_PENDING") {
          setRejected(data.outcome);
          stopped = true;
          clearInterval(iv);
          return;
        }

        const bs = data?.booking?.bookingStatus;
        if (bs === "FAILED" || data?.paymentStatus === "FAILED") {
          setError("Il pagamento non è andato a buon fine. Riprova o contatta l'assistenza.");
          stopped = true;
          clearInterval(iv);
          return;
        }

        // Stop polling only once the booking row exists and is confirmed — paymentStatus
        // can read "PAID" from Stripe before the webhook has created the booking.
        const isPaid = bs === "CONFIRMED" || bs === "COMPLETED";

        if (isPaid) {
          stopped = true;
          clearInterval(iv);
        }
      } catch (e) {
        if (!alive || stopped) return;
        setError(e.message || "Impossibile caricare il riepilogo prenotazione.");
        setLoading(false);
      }
    };

    tick();
    iv = setInterval(tick, 2000);
    return () => {
      alive = false;
      stopped = true;
      clearInterval(iv);
    };
  }, [sessionId]);

  /* fetch service — single-service bookings only (multi renders plain rows from booking.services) */
  useEffect(() => {
    let alive = true;
    const serviceId = summary?.booking?.serviceId;
    if (!serviceId || (summary?.booking?.services?.length || 0) > 1) return;
    fetchServiceById(serviceId)
      .then(s => {
        if (alive) setService(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [summary?.booking?.serviceId, summary?.booking?.services?.length]);

  /* Fix 21: clear the cart strictly when THIS session's order is truly completed — a confirmed
     booking (CONFIRMED/COMPLETED, not a bare PAID read which Stripe can report before the webhook
     creates the booking) whose Stripe session id matches the marker stored at checkout. A stale
     marker from an abandoned or unrelated checkout (e.g. a single "Prenota ora") won't match the
     current session_id, so it can never wrongly clear the cart. */
  useEffect(() => {
    const bs = summary?.booking?.bookingStatus;
    const confirmed = bs === "CONFIRMED" || bs === "COMPLETED";
    if (confirmed && sessionId && sessionStorage.getItem("br_cart_checkout") === sessionId) {
      dispatch(clearCart());
      sessionStorage.removeItem("br_cart_checkout");
    }
  }, [summary, sessionId, dispatch]);

  /* reveal */
  useEffect(() => {
    const els = document.querySelectorAll(".conf-reveal");
    if (!els.length) return;
    const obs = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add("conf-reveal--visible");
            obs.unobserve(e.target);
          }
        }),
      { threshold: 0.08 },
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [summary]);

  const b = summary?.booking;

  const paid = useMemo(() => {
    if (!b) return false;
    // Audit K / Fix 23: a terminal-failed booking is NEVER "paid", even if Stripe still reports
    // paymentStatus = "PAID" — otherwise a rejected+refunded single booking renders the confirmed screen.
    if (b.bookingStatus === "CANCELLED" || b.bookingStatus === "FAILED") return false;
    return summary?.paymentStatus === "PAID" || b.bookingStatus === "CONFIRMED" || b.bookingStatus === "COMPLETED";
  }, [summary?.paymentStatus, b]);

  const shortCode = useMemo(() => {
    const id = b?.bookingId || "";
    return id ? `BR-${id.slice(-6).toUpperCase()}` : "–";
  }, [b?.bookingId]);

  const stepsData = [
    { label: "Pagamento", done: paid, active: !paid },
    { label: "Prenotazione", done: paid, active: false },
    { label: "Appuntamento", done: false, active: paid },
  ];

  /* ── Pay-in-store success screen ── */
  if (payInStore && !loading)
    return (
      <div className="conf-page">
        <SEO title="Prenotazione confermata" noindex={true} />
        <section className="conf-hero conf-reveal conf-reveal--visible" style={{ "--conf-delay": "0s" }}>
          <span className="conf-spark">✦</span>
          <span className="conf-badge conf-badge--paid"><span className="conf-badge__dot" /> Prenotazione confermata</span>
          <h1 className="conf-title">Ci vediamo presto</h1>
          <div className="conf-divider" />
          <p className="conf-subtitle">
            La tua prenotazione è confermata. Pagherai direttamente in studio.
            Riceverai un'email di riepilogo a breve.
          </p>
          <div style={{ marginTop: "2rem" }}>
            <Link to="/area-personale" className="conf-btn-primary">
              Visualizza le mie prenotazioni
            </Link>
          </div>
        </section>
      </div>
    );

  /* ── Rejected screen (Audit K / Fix 23): slot taken while paying → booking refused + refunded ── */
  if (rejected) {
    const refundPending = rejected === "REJECTED_REFUND_PENDING";
    // Flow-aware retry: the single ("Prenota ora") rejected hold carries its serviceId → back to that
    // service; the MULTI tombstone has no serviceId → back to the cart (items are preserved on rejection).
    const retryTo = b?.serviceId ? `/trattamenti/${b.serviceId}` : "/carrello";
    const retryLabel = b?.serviceId ? "Scegli un altro orario" : "Torna al carrello";
    return (
      <>
        <SEO title="Orario non più disponibile" noindex={true} />
        <div className="conf-page">
          <div className="conf-error conf-reveal conf-reveal--visible">
            <span className="conf-spark">✦</span>
            <h1 className="conf-title">Questo orario non è più disponibile</h1>
            <div className="conf-divider" />
            <p className="conf-subtitle">
              {refundPending
                ? "Questo orario è appena stato prenotato da qualcun altro e non siamo riusciti a completare la tua prenotazione. C'è stato un problema con il rimborso automatico: scrivici e lo sistemiamo subito."
                : "Questo orario è appena stato prenotato da qualcun altro mentre completavi il pagamento. Abbiamo annullato la prenotazione e rimborsato l'intero importo: lo vedrai tornare sul tuo metodo di pagamento entro pochi giorni lavorativi."}
            </p>
            <div className="conf-cta-wrap" style={{ marginTop: "2rem" }}>
              {refundPending ? (
                <>
                  <a
                    href={`https://wa.me/${BRAND_WHATSAPP}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="conf-btn-primary"
                  >
                    Scrivici su WhatsApp
                  </a>
                  <Link to={retryTo} className="conf-btn-ghost">
                    {retryLabel}
                  </Link>
                </>
              ) : (
                <>
                  <Link to={retryTo} className="conf-btn-primary">
                    {retryLabel}
                  </Link>
                  <Link to="/" className="conf-btn-ghost">
                    Torna alla Home
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── States ── */
  if (loading)
    return (
      <>
        <SEO
          title="Prenotazione confermata"
          description="La tua prenotazione è stata confermata. Riceverai un'email di riepilogo a breve."
          noindex={true}
        />
        <div className="conf-page d-flex justify-content-center align-items-center">
          <Spinner animation="border" style={{ color: "#b8976a", width: 36, height: 36 }} />
        </div>
      </>
    );

  if (error)
    return (
      <>
        <SEO
          title="Prenotazione confermata"
          description="La tua prenotazione è stata confermata. Riceverai un'email di riepilogo a breve."
          noindex={true}
        />
        <div className="conf-page">
          <div className="conf-error conf-reveal conf-reveal--visible">
            <span className="conf-spark">✦</span>
            <p className="conf-subtitle">{error}</p>
            <Link to="/" className="conf-btn-primary">
              Torna alla Home
            </Link>
          </div>
        </div>
      </>
    );

  /* ── Render ── */
  return (
    <div className="conf-page">
      <SEO
        title="Prenotazione confermata"
        description="La tua prenotazione è stata confermata. Riceverai un'email di riepilogo a breve."
        noindex={true}
      />
      {/* ── HERO ── */}
      <section className="conf-hero conf-reveal" style={{ "--conf-delay": "0s" }}>
        <span className="conf-spark">✦</span>
        <StatusBadge paid={paid} />
        <h1 className="conf-title">{paid ? "Ci vediamo presto" : "Quasi fatto"}</h1>
        <div className="conf-divider" />
        <p className="conf-subtitle">
          {paid
            ? "La tua prenotazione è confermata. Troverai tutti i dettagli nell'email di conferma."
            : "Stiamo verificando il pagamento. Ricarica tra qualche secondo o attendi l'email di conferma."}
        </p>
        <div className="conf-code">{shortCode}</div>
        <Steps items={stepsData} />
      </section>

      {/* ── CARDS ── */}
      <Container className="conf-content">
        <Row className="g-4">
          {/* Cliente */}
          <Col lg={6} className="d-flex">
            <div className="conf-card conf-reveal w-100" style={{ "--conf-delay": "0.12s" }}>
              <div className="conf-card__header">
                <p className="conf-card__header-title">Dettagli cliente</p>
              </div>
              <div className="conf-card__body">
                <div className="conf-detail-row">
                  <span className="conf-detail-label">Nome</span>
                  <span className="conf-detail-value">{b?.customerName || "–"}</span>
                </div>
                <div className="conf-detail-row">
                  <span className="conf-detail-label">Email</span>
                  <span className="conf-detail-value">{summary?.email || b?.customerEmail || "–"}</span>
                </div>
                {b?.customerPhone && (
                  <div className="conf-detail-row">
                    <span className="conf-detail-label">Telefono</span>
                    <span className="conf-detail-value">{b.customerPhone}</span>
                  </div>
                )}
                <div className="conf-detail-row">
                  <span className="conf-detail-label">Stato</span>
                  <StatusBadge paid={paid} />
                </div>
              </div>
            </div>
          </Col>

          {/* Prenotazione */}
          <Col lg={6} className="d-flex">
            <div className="conf-card conf-reveal w-100" style={{ "--conf-delay": "0.22s" }}>
              <div className="conf-card__header">
                <p className="conf-card__header-title">Dettagli prenotazione</p>
              </div>
              <div className="conf-card__body">
                {/* Servizi — multi: una riga per trattamento; single ("Prenota ora"): blocco con thumbnail */}
                {b?.services?.length ? (
                  b.services.map((s, i) => (
                    <div key={s.id} className="conf-detail-row">
                      <span className="conf-detail-label">{i === 0 ? (b.services.length > 1 ? "Trattamenti" : "Trattamento") : ""}</span>
                      <span className="conf-detail-value">
                        {s.name}{s.optionName ? ` · ${s.optionName}` : ""}
                        {(s.durationMinutes != null || s.price != null) && (
                          <>
                            {" — "}
                            {s.durationMinutes != null ? `${s.durationMinutes} min` : ""}
                            {s.durationMinutes != null && s.price != null ? " · " : ""}
                            {s.price != null ? s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" }) : ""}
                          </>
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="conf-detail-row">
                    <span className="conf-detail-label">Trattamento</span>
                    <div className="conf-service-block">
                      {service?.images?.[0] && (
                        <div className="conf-service-thumb">
                          <img src={service.images[0]} alt={service.title} />
                        </div>
                      )}
                      <div>
                        <div className="conf-service-name">{service?.title || b?.serviceId || "–"}{b?.serviceOptionName ? ` · ${b.serviceOptionName}` : ""}</div>
                        {service?.durationMin != null && service?.price != null && (
                          <div className="conf-service-meta">
                            {service.durationMin} min ·{" "}
                            {service.price.toLocaleString("it-IT", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Prodotti — sale standalone pagate online */}
                {b?.sales?.length > 0 &&
                  b.sales.map((p, i) => (
                    <div key={p.saleId} className="conf-detail-row">
                      <span className="conf-detail-label">{i === 0 ? "Prodotti" : ""}</span>
                      <span className="conf-detail-value">
                        {p.productName} ×{p.quantity}
                        {p.unitPrice != null
                          ? ` · ${(p.unitPrice * p.quantity).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`
                          : ""}
                      </span>
                    </div>
                  ))}

                {/* Inizio */}
                <div className="conf-detail-row">
                  <span className="conf-detail-label">Data e ora</span>
                  <span className="conf-detail-value">{fmtDate(b?.startTime)}</span>
                </div>

                {/* Fine */}
                {b?.endTime && (
                  <div className="conf-detail-row">
                    <span className="conf-detail-label">Fine prevista</span>
                    <span className="conf-detail-value">{fmtDate(b.endTime)}</span>
                  </div>
                )}

                {/* Note */}
                {b?.notes && (
                  <div className="conf-detail-row">
                    <span className="conf-detail-label">Note</span>
                    <span className="conf-detail-value">{b.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </Col>
        </Row>

        {/* CTAs */}
        <div className="conf-cta-wrap conf-reveal" style={{ "--conf-delay": "0.32s" }}>
          <Link to="/trattamenti" className="conf-btn-ghost">
            Prenota un altro trattamento
          </Link>
          <Link to="/" className="conf-btn-primary">
            Torna alla Home
          </Link>
        </div>
      </Container>
    </div>
  );
}
