import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Container, Card, Button, Spinner, Alert } from "react-bootstrap";
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
      <Container className="py-5 d-flex justify-content-center align-items-center container-base" style={{ marginTop: "7rem", minHeight: "40vh" }}>
        <div className="d-flex flex-column align-items-center gap-3">
          <Spinner animation="border" />
          <p className="text-muted mb-0">Caricamento dettagli prenotazione...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5 container-base" style={{ marginTop: "7rem" }}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-4">
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              <Link to="/">
                <Button variant="dark">Torna alla Home</Button>
              </Link>
              <Link to="/prenotazioni">
                <Button variant="outline-dark">Vai ai miei appuntamenti</Button>
              </Link>
            </div>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  const shortCode = data?.booking?.bookingId
    ? `BR-${String(data.booking.bookingId).slice(-6).toUpperCase()}`
    : null;

  return (
    <Container className="py-5 container-base">
      <Card className="order-hero border-0 shadow-sm">
        <Card.Body className="d-flex flex-column align-items-center text-center py-5">
          <div className="status-badge paid">Pagamento confermato</div>
          <h2 className="mt-3 mb-2">Prenotazione completata con successo!</h2>
          {shortCode && (
            <>
              <p className="text-muted mb-1">Codice prenotazione</p>
              <p className="order-id mb-2">{shortCode}</p>
            </>
          )}
          <p className="lead text-muted mb-4">
            Ti abbiamo inviato un'email con tutti i dettagli della prenotazione.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            <Link to="/trattamenti">
              <Button variant="dark">Torna ai trattamenti</Button>
            </Link>
            <Link to="/prenotazioni">
              <Button variant="outline-dark">Vai ai miei appuntamenti</Button>
            </Link>
            <Link to="/">
              <Button variant="outline-secondary">Torna alla Home</Button>
            </Link>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default BookingSuccessPage;
