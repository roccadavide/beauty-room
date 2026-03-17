import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { fetchBookingSummary } from "../../api/modules/stripe.api";

const BOOKING_SUMMARY_ERROR_MESSAGE =
  "Non è stato possibile recuperare i dettagli della prenotazione. Controlla la tua email per la conferma.";
const INVALID_SESSION_MESSAGE = "Sessione di pagamento non valida o mancante.";

const BookingSuccessPage = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!sessionId || sessionId.trim() === "") {
      setError(INVALID_SESSION_MESSAGE);
      setLoading(false);
      return;
    }

    let alive = true;

    const load = async () => {
      try {
        const result = await fetchBookingSummary(sessionId);
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

  if (loading) {
    return (
      <div className="bs-page">
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

  const shortCode = data?.booking?.bookingId
    ? `BR-${String(data.booking.bookingId).slice(-6).toUpperCase()}`
    : null;

  return (
    <div className="bs-page">
      <div className="bs-hero">
        <div className="bs-hero__check">✓</div>
        <span className="section-eyebrow">Prenotazione confermata</span>
        <h1 className="bs-hero__title">Ci vediamo presto</h1>
        <p className="bs-hero__sub">Ti abbiamo inviato una email con tutti i dettagli.</p>
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
                <strong>{data.booking.serviceId}</strong>
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
