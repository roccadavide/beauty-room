import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Container, Row, Col, Card, ListGroup, Badge, Button, Spinner, Alert, Image } from "react-bootstrap";
import { fetchBookingSummary } from "../../api/modules/stripe.api";
import { fetchServiceById } from "../../api/modules/services.api";

export default function BookingConfirmation() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [service, setService] = useState(null);

  const formatDateTime = isoLike => {
    if (!isoLike) return "-";
    let d = new Date(isoLike);

    if (Number.isNaN(d.getTime())) {
      const fixed = /Z$|[+-]\d{2}:\d{2}$/.test(isoLike) ? isoLike : `${isoLike}Z`;
      d = new Date(fixed);
    }

    if (Number.isNaN(d.getTime())) return isoLike;

    return new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  useEffect(() => {
    if (!sessionId) {
      setError("Session ID mancante.");
      setLoading(false);
      return;
    }

    let alive = true;
    let stopped = false;
    let iv = null;

    const tick = async () => {
      try {
        const data = await fetchBookingSummary(sessionId);
        if (!alive || stopped) return;

        if (data?.status === "ERROR") {
          setError(data.message || "Impossibile caricare la prenotazione.");
          setLoading(false);
          stopped = true;
          if (iv) clearInterval(iv);
          return;
        }

        setSummary(data);
        setLoading(false);

        const bs = data?.booking?.bookingStatus;
        const isPaid = data?.status === "PAID" || bs === "CONFIRMED" || bs === "COMPLETED" || Boolean(data?.booking?.paidAt);

        if (isPaid) {
          stopped = true;
          if (iv) clearInterval(iv);
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
      if (iv) clearInterval(iv);
    };
  }, [sessionId]);

  // ---------------------------
  // Load service (when serviceId available)
  // ---------------------------
  useEffect(() => {
    let alive = true;

    async function loadService() {
      const serviceId = summary?.booking?.serviceId;
      if (!serviceId) return;

      try {
        const s = await fetchServiceById(serviceId);
        if (!alive) return;
        setService(s);
      } catch {
        if (!alive) return;
        setService(null);
      }
    }

    loadService();
    return () => {
      alive = false;
    };
  }, [summary?.booking?.serviceId]);

  // reveal (se vuoi)
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [summary]);

  const b = summary?.booking;

  const paid = useMemo(() => {
    const bookingStatus = b?.bookingStatus;
    const paidAt = b?.paidAt;
    return summary?.status === "PAID" || bookingStatus === "CONFIRMED" || bookingStatus === "COMPLETED" || Boolean(paidAt);
  }, [summary?.status, b?.bookingStatus, b?.paidAt]);

  const shortCode = useMemo(() => {
    const id = b?.bookingId || "";
    return id ? `BR-${id.slice(-6).toUpperCase()}` : "";
  }, [b?.bookingId]);

  const serviceThumb = service?.images?.[0] || null;

  if (loading) {
    return (
      <Container className="py-5 d-flex justify-content-center" style={{ marginTop: "7rem" }}>
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5" style={{ marginTop: "7rem" }}>
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
        <Link to="/">
          <Button variant="dark">Torna alla Home</Button>
        </Link>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="order-hero reveal">
        <Card.Body className="d-flex flex-column align-items-center text-center">
          <div className={`status-badge ${paid ? "paid" : "pending"}`}>{paid ? "Pagamento confermato" : "Pagamento in elaborazione"}</div>

          <h2 className="mt-3 mb-2">{paid ? "Prenotazione confermata ✅" : "Quasi fatto ⏳"}</h2>

          {/* Codice: utile ma in versione corta */}
          <p className="text-muted mb-1">Codice prenotazione</p>
          <p className="order-id mb-2">{shortCode}</p>

          <p className="lead">
            {paid
              ? "La tua prenotazione è stata registrata. Riceverai una conferma via email."
              : "Stiamo attendendo la conferma del pagamento. Se ricarichi tra qualche secondo, lo stato si aggiornerà."}
          </p>

          <div className="steps">
            <div className={`step ${paid ? "done" : "active"}`}>
              <span className="dot" />
              <span>Pagamento</span>
            </div>
            <div className={`step ${paid ? "active" : ""}`}>
              <span className="dot" />
              <span>Prenotazione</span>
            </div>
            <div className="step">
              <span className="dot" />
              <span>Appuntamento</span>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* 50/50 */}
      <Row className="g-4 mt-1 align-items-stretch">
        <Col lg={6} className="d-flex">
          <Card className="reveal w-100">
            <Card.Header as="h5">Dettagli cliente</Card.Header>
            <ListGroup variant="flush" className="flex-grow-1">
              <ListGroup.Item>
                <strong>Cliente:</strong>
                <br />
                {b?.customerName || "-"}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Email:</strong>
                <br />
                {summary?.email || b?.customerEmail || "-"}
              </ListGroup.Item>
              {b?.customerPhone && (
                <ListGroup.Item>
                  <strong>Telefono:</strong>
                  <br />
                  {b.customerPhone}
                </ListGroup.Item>
              )}
              <ListGroup.Item>
                <div className="d-flex align-items-center gap-2">
                  <span>Stato:</span>
                  <Badge bg={paid ? "success" : "warning"}>{paid ? "PAGATO" : "PENDING"}</Badge>
                </div>
              </ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>

        <Col lg={6} className="d-flex">
          <Card className="reveal w-100">
            <Card.Header as="h5">Dettagli prenotazione</Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <strong>Servizio:</strong>
                <div className="d-flex align-items-center gap-3 mt-2">
                  {serviceThumb && (
                    <Image
                      src={serviceThumb}
                      alt={service?.title || "Servizio"}
                      rounded
                      style={{ width: 56, height: 56, objectFit: "cover", flex: "0 0 auto" }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 600 }}>{service?.title || b?.serviceId || "-"}</div>
                    {service?.durationMin != null && service?.price != null && (
                      <small className="text-muted">
                        {service.durationMin} min · {service.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                      </small>
                    )}
                  </div>
                </div>
              </ListGroup.Item>

              {b?.serviceOptionId && (
                <ListGroup.Item>
                  <strong>Opzione:</strong>
                  <br />
                  {b.serviceOptionId}
                </ListGroup.Item>
              )}

              <ListGroup.Item>
                <strong>Data e ora:</strong>
                <br />
                <br />
                <span>
                  <strong>Inizio:</strong> {formatDateTime(b?.startTime)}
                </span>
                <br />
                <span>
                  <strong>Fine: </strong>
                  {formatDateTime(b?.endTime)}
                </span>
              </ListGroup.Item>

              {b?.notes && (
                <ListGroup.Item>
                  <strong>Note:</strong>
                  <br />
                  {b.notes}
                </ListGroup.Item>
              )}
            </ListGroup>
          </Card>
        </Col>

        <div className="d-flex justify-content-center flex-wrap gap-2 mt-3 reveal">
          <Link to="/trattamenti">
            <Button variant="outline-dark">Prenota un altro trattamento</Button>
          </Link>
          <Link to="/">
            <Button variant="dark">Torna alla Home</Button>
          </Link>
        </div>
      </Row>
    </Container>
  );
}
