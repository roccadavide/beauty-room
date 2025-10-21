import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Container, Row, Col, Card, ListGroup, Badge, Button, Spinner, Alert } from "react-bootstrap";
import { fetchOrderSummary } from "../api/modules/stripe.api";
import { fetchProductById } from "../api/modules/products.api";

const PLACEHOLDER = "/assets/placeholder.jpg";

const currency = v => Number(v || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [productMap, setProductMap] = useState({});

  // ---- load order summary ----
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!sessionId) {
        setLoading(false);
        setError("Session ID mancante.");
        return;
      }

      try {
        const data = await fetchOrderSummary(sessionId);
        if (!alive) return;

        if (data.status === "ERROR") {
          setError(data.message || "Impossibile caricare l'ordine.");
          setLoading(false);
          return;
        }

        setOrder(data);
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        setError(err.message || "Impossibile caricare il riepilogo ordine.");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // ---- fetch product details in parallel ----
  useEffect(() => {
    let alive = true;
    if (!order?.items?.length) return;

    const uniqueIds = [...new Set(order.items.map(i => i.productId).filter(Boolean))];
    if (!uniqueIds.length) return;

    (async () => {
      try {
        const results = await Promise.allSettled(uniqueIds.map(id => fetchProductById(id)));
        if (!alive) return;

        const map = {};
        results.forEach((r, idx) => {
          const id = uniqueIds[idx];
          if (r.status === "fulfilled") {
            const p = r.value;
            map[id] = {
              name: p.name || p.title || "Prodotto",
              image: p.image || p.images?.[0] || PLACEHOLDER,
            };
          } else {
            map[id] = { name: "Prodotto", image: PLACEHOLDER };
          }
        });
        setProductMap(map);
      } catch {
        // 
      }
    })();

    return () => {
      alive = false;
    };
  }, [order]);

  // ---- intersection observer (reveal on scroll) ----
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
  }, [order]);

  const paid = order?.status === "PAID";
  const total = useMemo(() => order?.items?.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0) || 0, [order]);

  // ---- UI states ----
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
    <Container className="py-5" style={{ marginTop: "7rem" }}>
      <Card className="order-hero reveal">
        <Card.Body className="d-flex flex-column align-items-center text-center">
          <div className={`status-badge ${paid ? "paid" : "pending"}`}>{paid ? "Pagamento confermato" : "Pagamento in elaborazione"}</div>

          <h2 className="mt-3 mb-2">{paid ? "Grazie per l’ordine!" : "Quasi fatto!"}</h2>
          <p className="text-muted mb-1">Numero ordine</p>
          <p className="order-id mb-2">{order.orderId}</p>

          <p className="lead">
            {paid
              ? "Ti abbiamo inviato una conferma via email."
              : "Stiamo attendendo la conferma di pagamento. Se chiudi questa pagina, potrai sempre rivedere il tuo ordine dall’email di riepilogo."}
          </p>

          <div className="steps">
            <div className={`step ${paid ? "done" : "active"}`}>
              <span className="dot" />
              <span>Pagamento</span>
            </div>
            <div className={`step ${paid ? "active" : ""}`}>
              <span className="dot" />
              <span>Preparazione</span>
            </div>
            <div className="step">
              <span className="dot" />
              <span>Ritiro</span>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Row className="g-4 mt-1">
        <Col lg={4}>
          <Card className="reveal">
            <Card.Header as="h5">Dettagli cliente</Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <strong>Cliente:</strong>
                <br />
                {order.customerName}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Email:</strong>
                <br />
                {order.customerEmail}
              </ListGroup.Item>
              {order.customerPhone && (
                <ListGroup.Item>
                  <strong>Telefono:</strong>
                  <br />
                  {order.customerPhone}
                </ListGroup.Item>
              )}
              {order.pickupNote && (
                <ListGroup.Item>
                  <strong>Nota per il ritiro:</strong>
                  <br />
                  {order.pickupNote}
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

        <Col lg={8}>
          <Card className="reveal">
            <Card.Header as="h5">Articoli acquistati</Card.Header>
            <ListGroup variant="flush">
              {order.items.map((it, idx) => {
                const pd = productMap[it.productId] || {};
                const line = Number(it.price) * it.quantity;
                return (
                  <ListGroup.Item key={idx} className="py-3">
                    <Row className="align-items-center">
                      <Col xs={3} md={2}>
                        <div className="thumb">
                          <img src={pd.image || PLACEHOLDER} alt={pd.name || "Prodotto"} />
                        </div>
                      </Col>
                      <Col xs={9} md={6}>
                        <div className="fw-semibold">{pd.name || "Prodotto"}</div>
                        <div className="text-muted small">ID: {it.productId}</div>
                        <div className="text-muted small">Prezzo: {currency(it.price)}</div>
                      </Col>
                      <Col xs={6} md={2} className="text-md-center mt-2 mt-md-0">
                        <span className="text-muted">Qt</span>
                        <div className="fs-5">{it.quantity}</div>
                      </Col>
                      <Col xs={6} md={2} className="text-end mt-2 mt-md-0">
                        <div className="fw-bold">{currency(line)}</div>
                      </Col>
                    </Row>
                  </ListGroup.Item>
                );
              })}

              <ListGroup.Item className="d-flex justify-content-between align-items-center py-3">
                <span className="fs-5 fw-semibold">Totale</span>
                <span className="fs-4 fw-bold">{currency(total)}</span>
              </ListGroup.Item>
            </ListGroup>
          </Card>

          <div className="d-flex flex-wrap gap-2 mt-3 reveal">
            <Link to="/prodotti">
              <Button variant="outline-dark">Continua a fare acquisti</Button>
            </Link>
            <Link to="/">
              <Button variant="dark">Torna alla Home</Button>
            </Link>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
