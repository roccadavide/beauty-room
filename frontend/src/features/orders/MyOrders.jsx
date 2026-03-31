import { useCallback, useEffect, useRef, useState } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import DeleteOrderModal from "./DeleteOrderModal";
import { deleteOrder, fetchMyOrders } from "../../api/modules/orders.api";
import { fetchProductById } from "../../api/modules/products.api";

const STATUS_LABELS = {
  PAID: { label: "Pagato", color: "#2d6a4f", bg: "rgba(45,106,79,0.1)" },
  PENDING: { label: "In attesa", color: "#b8976a", bg: "rgba(184,151,106,0.12)" },
  CANCELLED: { label: "Cancellato", color: "#c0392b", bg: "rgba(192,57,43,0.1)" },
  COMPLETED: { label: "Ritirato", color: "#2e2118", bg: "rgba(46,33,24,0.08)" },
};

const MyOrders = () => {
  const [myOrders, setMyOrders] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

  const navigate = useNavigate();
  const { accessToken } = useSelector(s => s.auth);
  const requestedRef = useRef(new Set());

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchMyOrders()
      .then(res => {
        if (!cancelled) setMyOrders(res || []);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const getProduct = useCallback(
    async id => {
      if (products[id] || requestedRef.current.has(id)) return;
      requestedRef.current.add(id);
      try {
        const prod = await fetchProductById(id);
        setProducts(prev => ({ ...prev, [id]: prod }));
      } catch {
        requestedRef.current.delete(id);
      }
    },
    [products],
  );

  useEffect(() => {
    myOrders.forEach(o =>
      o.orderItems?.forEach(i => {
        if (i?.productId) getProduct(i.productId);
      }),
    );
  }, [myOrders, getProduct]);

  const handleDeleteConfirm = async id => {
    try {
      await deleteOrder(id);
      setMyOrders(prev => prev.filter(o => o.orderId !== id));
      setDeleteModal(false);
      setSelectedOrder(null);
    } catch (err) {
      alert("Errore durante l'eliminazione: " + err.message);
    }
  };

  if (loading)
    return (
      <div className="mo-page">
        <Container className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </Container>
      </div>
    );

  if (error)
    return (
      <div className="mo-page">
        <Container>
          <p className="text-danger mt-5">{error}</p>
        </Container>
      </div>
    );

  return (
    <div className="mo-page">
      <Container>
        {/* Header */}
        <div className="mo-header">
          <span className="section-eyebrow">I tuoi acquisti</span>
          <h1 className="mo-title">I miei ordini</h1>
          <p className="mo-subtitle">
            {myOrders.length > 0
              ? `${myOrders.length} ordin${myOrders.length > 1 ? "i" : "e"} trovat${myOrders.length > 1 ? "i" : "o"}`
              : "Nessun ordine ancora"}
          </p>
        </div>

        {/* Empty state */}
        {myOrders.length === 0 && (
          <div className="mo-empty">
            <div className="mo-empty-icon">✦</div>
            <h3>Ancora nessun acquisto</h3>
            <p>Esplora i nostri prodotti e trattamenti</p>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <button className="mo-empty-btn" onClick={() => navigate("/prodotti")}>
                Vai ai Prodotti
              </button>
              <button className="mo-empty-btn mo-empty-btn--outline" onClick={() => navigate("/trattamenti")}>
                Vai ai Trattamenti
              </button>
            </div>
          </div>
        )}

        {/* Order cards */}
        <div className="mo-list">
          {myOrders.map((order, idx) => {
            const st = STATUS_LABELS[order.orderStatus] || STATUS_LABELS.PENDING;
            const isExpanded = expandedOrder === order.orderId;
            const total = order.orderItems?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;

            return (
              <div key={order.orderId} className="mo-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                {/* Card header */}
                <div className="mo-card-header" onClick={() => setExpandedOrder(isExpanded ? null : order.orderId)}>
                  <div className="mo-card-left">
                    <div className="mo-order-num">Ordine #{order.orderId?.slice(-8).toUpperCase()}</div>
                    <div className="mo-order-date">
                      {new Date(order.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <div className="mo-card-right">
                    <span className="mo-status-pill" style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                    <span className="mo-total">€ {total.toFixed(2)}</span>
                    <span className="mo-expand-icon">{isExpanded ? "−" : "+"}</span>
                  </div>
                </div>

                {/* Thumbnail preview */}
                <div className="mo-items-preview">
                  {order.orderItems?.slice(0, 3).map(item => {
                    const prod = products[item.productId];
                    return (
                      <div key={item.orderItemId} className="mo-item-thumb" title={prod?.name || "Prodotto"}>
                        {prod?.images?.[0] ? <img src={prod.images[0]} alt={prod.name} /> : <div className="mo-item-thumb-placeholder" />}
                      </div>
                    );
                  })}
                  {order.orderItems?.length > 3 && <div className="mo-item-thumb mo-item-more">+{order.orderItems.length - 3}</div>}
                </div>

                {/* Expandable detail */}
                {isExpanded && (
                  <div className="mo-detail-expanded">
                    <div className="mo-detail-divider" />

                    {order.orderItems?.map(item => {
                      const prod = products[item.productId];
                      return (
                        <div key={item.orderItemId} className="mo-detail-item" onClick={() => prod && navigate(`/prodotti/${prod.productId}`)}>
                          <div className="mo-detail-img">
                            {prod?.images?.[0] ? <img src={prod.images[0]} alt={prod.name} /> : <div className="mo-detail-img-ph" />}
                          </div>
                          <div className="mo-detail-info">
                            <p className="mo-detail-name">{prod?.name || "Prodotto"}</p>
                            <p className="mo-detail-sub">
                              Quantità: {item.quantity} · € {item.price.toFixed(2)} cad.
                            </p>
                          </div>
                          <p className="mo-detail-subtotal">€ {(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      );
                    })}

                    <div className="mo-detail-footer">
                      {order.pickupNote && <p className="mo-detail-note">📋 {order.pickupNote}</p>}
                      <div className="mo-detail-actions">
                        {order.orderStatus === "PENDING" && (
                          <button
                            className="mo-delete-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                              setDeleteModal(true);
                            }}
                          >
                            Elimina ordine
                          </button>
                        )}
                        {(order.orderStatus === "PAID" || order.orderStatus === "COMPLETED") && (
                          <button
                            className="mo-contact-btn"
                            onClick={e => {
                              e.stopPropagation();
                              window.location.href = `mailto:michela@beautyroom.it?subject=Richiesta cancellazione ordine %23${order.orderId?.slice(-8).toUpperCase()}&body=Buongiorno, vorrei richiedere la cancellazione dell'ordine.`;
                            }}
                          >
                            Richiedi cancellazione →
                          </button>
                        )}
                        {order.orderStatus === "CANCELLED" && (
                          <span className="mo-cancelled-note">Ordine gia cancellato</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Container>

      <DeleteOrderModal show={deleteModal} onHide={() => setDeleteModal(false)} order={selectedOrder} onConfirm={handleDeleteConfirm} />
    </div>
  );
};

export default MyOrders;
