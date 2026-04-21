import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { fetchBookingSummary } from "../../api/modules/stripe.api";
import { fetchServiceById } from "../../api/modules/services.api";
import SEO from "../../components/common/SEO";

const BOOKING_SUMMARY_ERROR_MESSAGE = "Non è stato possibile recuperare i dettagli della prenotazione. Controlla la tua email per la conferma.";
const INVALID_SESSION_MESSAGE = "Sessione di pagamento non valida o mancante.";

const BookingSuccessPage = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [serviceTitle, setServiceTitle] = useState(null);
  const [serviceTitleLoading, setServiceTitleLoading] = useState(false);

  useEffect(() => {
    if (!sessionId || sessionId.trim() === "") {
      setError(INVALID_SESSION_MESSAGE);
      setLoading(false);
      return;
    }

    let alive = true;

    // Retry con backoff esponenziale per gestire Railway cold start
    const fetchWithRetry = async (fetchFn, maxAttempts = 4, baseDelayMs = 1500) => {
      let lastError;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await fetchFn();
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(1.8, attempt)));
          }
        }
      }
      throw lastError;
    };

    const load = async () => {
      try {
        const result = await fetchWithRetry(() => fetchBookingSummary(sessionId));
        if (!alive) return;

        if (result?.status === "ERROR") {
          setError(result.message || BOOKING_SUMMARY_ERROR_MESSAGE);
          setLoading(false);
          return;
        }

        setData(result);
      } catch (err) {
        if (!alive) return;
        setError(BOOKING_SUMMARY_ERROR_MESSAGE);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // FIX-3: fallback fetch del titolo servizio se il backend non include serviceTitle
  useEffect(() => {
    const serviceId = data?.booking?.serviceId;
    if (!serviceId || data?.booking?.serviceTitle) return;

    let alive = true;
    setServiceTitleLoading(true);

    fetchServiceById(serviceId)
      .then(service => {
        if (alive) setServiceTitle(service?.title ?? null);
      })
      .catch(() => {
        /* silenzioso: l'UUID rimane come fallback */
      })
      .finally(() => {
        if (alive) setServiceTitleLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [data]);

  if (loading) {
    return (
      <div className="bs-page">
        <SEO title="Prenotazione confermata" description="La tua prenotazione è stata confermata. Riceverai un'email di riepilogo a breve." noindex={true} />
        <div className="bs-loading">
          <Spinner animation="border" style={{ color: "#b8976a" }} />
          <p>Verifica prenotazione in corso…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bs-page">
        <SEO title="Prenotazione confermata" description="La tua prenotazione è stata confermata. Riceverai un'email di riepilogo a breve." noindex={true} />
        <div className="bs-error-card">
          <div className="bs-error-icon">⚠️</div>
          <h2>Qualcosa non ha funzionato</h2>
          <p>{error}</p>
          <div className="bs-actions">
            <Link to="/" className="bs-btn bs-btn--primary">
              Torna alla Home
            </Link>
            <Link to="/prenotazioni" className="bs-btn bs-btn--ghost">
              I miei appuntamenti
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const shortCode = data?.booking?.bookingId ? `BR-${String(data.booking.bookingId).slice(-6).toUpperCase()}` : null;
  const paymentStatus = data?.paymentStatus;
  const isPaid = paymentStatus === "PAID";
  const isFailedOrCancelled = paymentStatus === "FAILED" || paymentStatus === "CANCELLED";
  const eyebrowText = isPaid ? "Prenotazione confermata" : isFailedOrCancelled ? "Pagamento non completato" : "Prenotazione ricevuta";
  const heroTitle = isPaid ? "Ci vediamo presto" : isFailedOrCancelled ? "Qualcosa non è andato a buon fine" : "In attesa di conferma pagamento";
  const heroSubtitle = isPaid
    ? "Ti abbiamo inviato una email con tutti i dettagli."
    : isFailedOrCancelled
      ? "Qualcosa non è andato a buon fine, contattaci."
      : "Prenotazione ricevuta, in attesa di conferma pagamento.";

  return (
    <div className="bs-page">
      <SEO title="Prenotazione confermata" description="La tua prenotazione è stata confermata. Riceverai un'email di riepilogo a breve." noindex={true} />
      <div className="bs-hero">
        <div className="bs-hero__check">✓</div>
        <span className="section-eyebrow">{eyebrowText}</span>
        <h1 className="bs-hero__title">{heroTitle}</h1>
        <p className="bs-hero__sub">{heroSubtitle}</p>
        {shortCode && (
          <div className="bs-code">
            <span className="bs-code__label">Codice prenotazione</span>
            <span className="bs-code__value">{shortCode}</span>
          </div>
        )}
      </div>

      {data?.booking && (
        <div className="bs-card">
          <div className="bs-card__header">
            <span className="section-eyebrow">Riepilogo</span>
          </div>

          <div className="bs-rows">
            {[
              { label: "Cliente", value: data.booking.customerName },
              { label: "Email", value: data.booking.customerEmail },
              { label: "Telefono", value: data.booking.customerPhone },
            ]
              .filter(r => r.value)
              .map(r => (
                <div key={r.label} className="bs-row">
                  <span>{r.label}</span>
                  <strong>{r.value}</strong>
                </div>
              ))}

            <div className="bs-row bs-row--divider" />

            {data.booking.serviceId && (
              <div className="bs-row">
                <span>Servizio</span>
                {/* FIX-3: mostra titolo servizio; fallback locale se non arriva dall'API */}
                <strong>
                  {data.booking.serviceTitle || serviceTitle
                    ? data.booking.serviceTitle || serviceTitle
                    : serviceTitleLoading
                      ? "Caricamento…"
                      : data.booking.serviceId}
                </strong>
              </div>
            )}
            {data.booking.startTime && (
              <div className="bs-row">
                <span>Data e ora</span>
                <strong>
                  {new Date(data.booking.startTime).toLocaleString("it-IT", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bs-actions">
        <Link to="/trattamenti" className="bs-btn bs-btn--ghost">
          Prenota un altro trattamento
        </Link>
        <Link to="/" className="bs-btn bs-btn--primary">
          Torna alla Home
        </Link>
      </div>
    </div>
  );
};

export default BookingSuccessPage;
