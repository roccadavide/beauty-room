import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { fetchOrderSummary } from "../../api/modules/stripe.api";
import { fetchProductById } from "../../api/modules/products.api";
import "../../styles/pages/_confirmation.css";
import SEO from "../../components/common/SEO";

const PLACEHOLDER = "/assets/placeholder.jpg";
const fmt = v => Number(v || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/* ── Sub-components ─────────────────────────────── */

function StatusBadge({ paid }) {
  return (
    <span className={`conf-badge ${paid ? "conf-badge--paid" : "conf-badge--pending"}`}>
      <span className="conf-badge__dot" />
      {paid ? "Pagamento confermato" : "In elaborazione"}
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

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [productMap, setProductMap] = useState({});

  /* fetch order */
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!sessionId) {
        setError("Session ID mancante.");
        setLoading(false);
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

  /* fetch product details */
  useEffect(() => {
    let alive = true;
    if (!order?.items?.length) return;
    const uniqueIds = [...new Set(order.items.map(i => i.productId).filter(Boolean))];
    if (!uniqueIds.length) return;
    (async () => {
      const results = await Promise.allSettled(uniqueIds.map(id => fetchProductById(id)));
      if (!alive) return;
      const map = {};
      results.forEach((r, idx) => {
        const id = uniqueIds[idx];
        map[id] =
          r.status === "fulfilled"
            ? {
                name: r.value.name || r.value.title || "Prodotto",
                image: r.value.image || r.value.images?.[0] || PLACEHOLDER,
              }
            : { name: "Prodotto", image: PLACEHOLDER };
      });
      setProductMap(map);
    })();
    return () => {
      alive = false;
    };
  }, [order]);

  /* intersection reveal */
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
  }, [order]);

  const paid = order?.status === "PAID";
  const total = useMemo(() => order?.items?.reduce((s, it) => s + Number(it.price) * it.quantity, 0) || 0, [order]);

  const stepsData = [
    { label: "Pagamento", done: paid, active: !paid },
    { label: "Preparazione", done: false, active: paid },
    { label: "Ritiro", done: false, active: false },
  ];

  /* ── States ── */
  if (loading)
    return (
      <>
        <SEO
          title="Ordine confermato"
          description="Il tuo ordine è stato ricevuto. Riceverai una email di conferma a breve."
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
          title="Ordine confermato"
          description="Il tuo ordine è stato ricevuto. Riceverai una email di conferma a breve."
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
        title="Ordine confermato"
        description="Il tuo ordine è stato ricevuto. Riceverai una email di conferma a breve."
        noindex={true}
      />
      {/* ── HERO ── */}
      <section className="conf-hero conf-reveal" style={{ "--conf-delay": "0s" }}>
        <span className="conf-spark">✦</span>
        <StatusBadge paid={paid} />
        <h1 className="conf-title">{paid ? "Grazie per il tuo ordine" : "Quasi fatto"}</h1>
        <div className="conf-divider" />
        <p className="conf-subtitle">
          {paid
            ? "Il tuo ordine è stato registrato. Riceverai una conferma via email a breve."
            : "Stiamo attendendo la conferma del pagamento. Ti invieremo un'email di riepilogo."}
        </p>
        <div className="conf-code">{order.orderId}</div>
        <Steps items={stepsData} />
      </section>

      {/* ── CARDS ── */}
      <Container className="conf-content">
        <Row className="g-4">
          {/* Cliente */}
          <Col lg={4} className="d-flex">
            <div className="conf-card conf-reveal w-100" style={{ "--conf-delay": "0.12s" }}>
              <div className="conf-card__header">
                <p className="conf-card__header-title">Dettagli cliente</p>
              </div>
              <div className="conf-card__body">
                <div className="conf-detail-row">
                  <span className="conf-detail-label">Nome</span>
                  <span className="conf-detail-value">{order.customerName}</span>
                </div>
                <div className="conf-detail-row">
                  <span className="conf-detail-label">Email</span>
                  <span className="conf-detail-value">{order.customerEmail}</span>
                </div>
                {order.customerPhone && (
                  <div className="conf-detail-row">
                    <span className="conf-detail-label">Telefono</span>
                    <span className="conf-detail-value">{order.customerPhone}</span>
                  </div>
                )}
                {order.pickupNote && (
                  <div className="conf-detail-row">
                    <span className="conf-detail-label">Nota ritiro</span>
                    <span className="conf-detail-value">{order.pickupNote}</span>
                  </div>
                )}
                <div className="conf-detail-row">
                  <span className="conf-detail-label">Stato</span>
                  <StatusBadge paid={paid} />
                </div>
              </div>
            </div>
          </Col>

          {/* Articoli */}
          <Col lg={8} className="d-flex">
            <div className="conf-card conf-reveal w-100" style={{ "--conf-delay": "0.22s" }}>
              <div className="conf-card__header">
                <p className="conf-card__header-title">Articoli acquistati</p>
              </div>
              <div className="conf-card__body">
                {order.items.map((it, idx) => {
                  const pd = productMap[it.productId] || {};
                  return (
                    <div key={idx} className="conf-item">
                      <div className="conf-item__thumb">
                        <img src={pd.image || PLACEHOLDER} alt={pd.name || "Prodotto"} />
                      </div>
                      <div className="conf-item__info">
                        <div className="conf-item__name">{pd.name || "Prodotto"}</div>
                        <div className="conf-item__meta">
                          Qt. {it.quantity} · {fmt(it.price)} cad.
                        </div>
                      </div>
                      <span className="conf-item__price">{fmt(Number(it.price) * it.quantity)}</span>
                    </div>
                  );
                })}

                <div className="conf-total">
                  <span className="conf-total__label">Totale ordine</span>
                  <span className="conf-total__amount">{fmt(total)}</span>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* CTAs */}
        <div className="conf-cta-wrap conf-reveal" style={{ "--conf-delay": "0.32s" }}>
          <Link to="/prodotti" className="conf-btn-ghost">
            Continua gli acquisti
          </Link>
          <Link to="/" className="conf-btn-primary">
            Torna alla Home
          </Link>
        </div>
      </Container>
    </div>
  );
}
