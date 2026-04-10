import { useEffect, useRef, useState } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import DeleteOrderModal from "./DeleteOrderModal";
import { deleteOrder, fetchOrders, refundOrder, updateOrderStatus } from "../../api/modules/orders.api";
import { fetchProductById } from "../../api/modules/products.api";
import SEO from "../../components/common/SEO";

const STATUS_LABELS = {
  PAID:              { label: "Pagato",     color: "#2d6a4f", bg: "rgba(45,106,79,0.1)" },
  PAID_PENDING_PICKUP: { label: "Pagato",   color: "#2d6a4f", bg: "rgba(45,106,79,0.1)" },
  PENDING:           { label: "In attesa",  color: "#b8976a", bg: "rgba(184,151,106,0.12)" },
  PENDING_PAYMENT:   { label: "In attesa",  color: "#b8976a", bg: "rgba(184,151,106,0.12)" },
  CANCELLED:         { label: "Cancellato", color: "#c0392b", bg: "rgba(192,57,43,0.1)" },
  CANCELED:          { label: "Cancellato", color: "#c0392b", bg: "rgba(192,57,43,0.1)" },
  COMPLETED:         { label: "Ritirato",   color: "#2e2118", bg: "rgba(46,33,24,0.08)" },
  REFUNDED:          { label: "Rimborsato", color: "#1a6b8a", bg: "rgba(26,107,138,0.1)" },
};

const isPaidStatus      = s => ["PAID", "PAID_PENDING_PICKUP"].includes(s);
const isPendingStatus   = s => ["PENDING", "PENDING_PAYMENT"].includes(s);
const isClosedStatus    = s => ["CANCELLED", "CANCELED", "COMPLETED"].includes(s);

const AllOrders = () => {
  const [allOrders, setAllOrders]       = useState([]);
  const [products, setProducts]         = useState({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteModal, setDeleteModal]   = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQ, setSearchQ]           = useState("");
  const [actionLoading, setActionLoading] = useState({});
  const [actionFeedback, setActionFeedback] = useState({});
  const [refundConfirm, setRefundConfirm] = useState(null);
  const { accessToken } = useSelector(s => s.auth);
  const navigate = useNavigate();
  const requested = useRef(new Set());

  useEffect(() => {
    fetchOrders()
      .then(res => setAllOrders(res.content ?? res ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    allOrders.forEach(o =>
      o.orderItems?.forEach(i => {
        if (!i?.productId || requested.current.has(i.productId)) return;
        requested.current.add(i.productId);
        fetchProductById(i.productId)
          .then(p => setProducts(prev => ({ ...prev, [i.productId]: p })))
          .catch(() => {});
      }),
    );
  }, [allOrders]);

  const setFeedback = (orderId, ok, msg) => {
    setActionFeedback(prev => ({ ...prev, [orderId]: { ok, msg } }));
    setTimeout(() => setActionFeedback(prev => ({ ...prev, [orderId]: null })), 3500);
  };

  const handleUpdateStatus = async (orderId, status) => {
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const updated = await updateOrderStatus(orderId, status);
      setAllOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, orderStatus: updated.orderStatus } : o));
      setFeedback(orderId, true, "Aggiornato.");
    } catch (err) {
      setFeedback(orderId, false, err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleRefund = async orderId => {
    setRefundConfirm(null);
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const updated = await refundOrder(orderId);
      setAllOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, orderStatus: updated.orderStatus } : o));
      setFeedback(orderId, true, "Rimborso effettuato.");
    } catch (err) {
      setFeedback(orderId, false, err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleDeleteConfirm = async id => {
    try {
      await deleteOrder(id);
      setAllOrders(prev => prev.filter(o => o.orderId !== id));
      setDeleteModal(false);
      setSelectedOrder(null);
    } catch (err) {
      setDeleteModal(false);
      setFeedback(id, false, err.message);
    }
  };

  const handleExportCsv = () => {
    const header = ["ID", "Nome", "Cognome", "Email", "Telefono", "Stato", "Totale€", "Data", "Prodotti"];
    const rows = filtered.map(o => {
      const total = o.orderItems?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;
      const prodotti = o.orderItems
        ?.map(i => {
          const p = products[i.productId];
          return p ? `${p.name} x${i.quantity}` : `#${String(i.productId).slice(0, 8)} x${i.quantity}`;
        })
        .join("; ") || "";
      const data = o.createdAt ? new Date(o.createdAt).toLocaleDateString("it-IT") : "";
      return [o.orderId, o.customerName, o.customerSurname, o.customerEmail, o.customerPhone || "", o.orderStatus, total.toFixed(2), data, prodotti];
    });

    const csv = [header, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordini-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = allOrders
    .filter(o => {
      if (filterStatus === "ALL") return true;
      if (filterStatus === "PAID") return isPaidStatus(o.orderStatus);
      if (filterStatus === "PENDING") return isPendingStatus(o.orderStatus);
      return o.orderStatus === filterStatus;
    })
    .filter(o => {
      if (!searchQ) return true;
      const q = searchQ.toLowerCase();
      return o.customerName?.toLowerCase().includes(q) || o.customerSurname?.toLowerCase().includes(q) || o.customerEmail?.toLowerCase().includes(q);
    });

  const grandTotal = filtered.reduce((s, o) => s + (o.orderItems?.reduce((ss, i) => ss + i.price * i.quantity, 0) || 0), 0);

  const totals = {
    ALL:       allOrders.length,
    PAID:      allOrders.filter(o => isPaidStatus(o.orderStatus)).length,
    PENDING:   allOrders.filter(o => isPendingStatus(o.orderStatus)).length,
    COMPLETED: allOrders.filter(o => o.orderStatus === "COMPLETED").length,
  };

  if (loading)
    return (
      <>
        <SEO title="Tutti gli ordini" description="Gestione amministrativa degli ordini Beauty Room." noindex={true} />
        <div className="ao-page">
          <Container className="d-flex justify-content-center py-5">
            <Spinner animation="border" />
          </Container>
        </div>
      </>
    );

  if (error)
    return (
      <>
        <SEO title="Tutti gli ordini" description="Gestione amministrativa degli ordini Beauty Room." noindex={true} />
        <div className="ao-page">
          <Container>
            <p className="text-danger mt-5">{error}</p>
          </Container>
        </div>
      </>
    );

  return (
    <div className="ao-page">
      <SEO title="Tutti gli ordini" description="Gestione amministrativa degli ordini Beauty Room." noindex={true} />
      <Container fluid="xl">
        {/* Header + KPI */}
        <div className="ao-header">
          <div>
            <span className="section-eyebrow">Pannello Admin</span>
            <h1 className="mo-title">Tutti gli ordini</h1>
          </div>
          <div className="ao-header-right">
            <div className="ao-kpi-row">
              <div className="ao-kpi">
                <span className="ao-kpi-val">{totals.ALL}</span>
                <span className="ao-kpi-label">Totale</span>
              </div>
              <div className="ao-kpi">
                <span className="ao-kpi-val" style={{ color: "#2d6a4f" }}>
                  {totals.PAID}
                </span>
                <span className="ao-kpi-label">Pagati</span>
              </div>
              <div className="ao-kpi">
                <span className="ao-kpi-val" style={{ color: "#b8976a" }}>
                  {totals.PENDING}
                </span>
                <span className="ao-kpi-label">In attesa</span>
              </div>
              <div className="ao-kpi">
                <span className="ao-kpi-val">€ {grandTotal.toFixed(0)}</span>
                <span className="ao-kpi-label">Totale filtrato</span>
              </div>
            </div>
            <button className="ao-btn-export" onClick={handleExportCsv}>
              ↓ Esporta CSV
            </button>
          </div>
        </div>

        {/* Filtri */}
        <div className="ao-filters">
          <div className="ao-filter-tabs">
            {["ALL", "PAID", "PENDING", "COMPLETED", "CANCELLED"].map(s => (
              <button key={s} className={`ao-filter-tab${filterStatus === s ? " ao-filter-tab--active" : ""}`} onClick={() => setFilterStatus(s)}>
                {s === "ALL" ? "Tutti" : STATUS_LABELS[s]?.label || s}
                {s !== "ALL" && <span className="ao-filter-count">{allOrders.filter(o => o.orderStatus === s).length}</span>}
              </button>
            ))}
          </div>
          <input className="ao-search" placeholder="Cerca per nome o email..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>

        {/* Orders */}
        <div className="mo-list">
          {filtered.map((order, idx) => {
            const st = STATUS_LABELS[order.orderStatus] || STATUS_LABELS.PENDING;
            const isExpanded = expandedOrder === order.orderId;
            const total = order.orderItems?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;
            const isLoading = !!actionLoading[order.orderId];
            const feedback = actionFeedback[order.orderId];
            const awaitingRefund = refundConfirm === order.orderId;

            return (
              <div key={order.orderId} className="mo-card" style={{ animationDelay: `${idx * 0.04}s` }}>
                <div className="mo-card-header" onClick={() => setExpandedOrder(isExpanded ? null : order.orderId)}>
                  <div className="mo-card-left">
                    <div className="mo-order-num">
                      {order.customerName} {order.customerSurname}
                    </div>
                    <div className="mo-order-date">
                      {order.customerEmail} · {new Date(order.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
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

                <div className="mo-items-preview">
                  {order.orderItems?.slice(0, 4).map(item => {
                    const prod = products[item.productId];
                    return (
                      <div key={item.orderItemId} className="mo-item-thumb" title={prod?.name}>
                        {prod?.images?.[0] ? <img src={prod.images[0]} alt={prod.name} /> : <div className="mo-item-thumb-placeholder" />}
                      </div>
                    );
                  })}
                  {order.orderItems?.length > 4 && <div className="mo-item-thumb mo-item-more">+{order.orderItems.length - 4}</div>}
                </div>

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
                              Qt: {item.quantity} · € {item.price.toFixed(2)} cad.
                            </p>
                          </div>
                          <p className="mo-detail-subtotal">€ {(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      );
                    })}

                    <div className="mo-detail-footer">
                      <div>
                        {order.customerPhone && <p className="mo-detail-note">📞 {order.customerPhone}</p>}
                        {order.pickupNote && <p className="mo-detail-note">📋 {order.pickupNote}</p>}
                        <p className="mo-detail-note" style={{ fontFamily: "monospace", fontSize: "0.72rem", opacity: 0.6 }}>
                          ID: {order.orderId}
                        </p>
                      </div>

                      <div className="ao-action-group">
                        {/* WhatsApp — always shown */}
                        {order.customerPhone && (
                          <a
                            href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=Ciao%20${order.customerName},%20riguardo%20al%20tuo%20ordine...`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ao-wa-btn"
                          >
                            WhatsApp
                          </a>
                        )}

                        {/* PAID: mark collected + refund */}
                        {isPaidStatus(order.orderStatus) && !awaitingRefund && (
                          <>
                            <button
                              className="ao-btn-complete"
                              disabled={isLoading}
                              onClick={e => { e.stopPropagation(); handleUpdateStatus(order.orderId, "COMPLETED"); }}
                            >
                              ✓ Segna ritirato
                            </button>
                            <button
                              className="ao-btn-refund"
                              disabled={isLoading}
                              onClick={e => { e.stopPropagation(); setRefundConfirm(order.orderId); }}
                            >
                              ↩ Annulla + rimborso
                            </button>
                          </>
                        )}

                        {/* PAID: refund confirm inline */}
                        {isPaidStatus(order.orderStatus) && awaitingRefund && (
                          <>
                            <span className="ao-confirm-text">Confermare rimborso?</span>
                            <button
                              className="ao-btn-refund"
                              disabled={isLoading}
                              onClick={e => { e.stopPropagation(); handleRefund(order.orderId); }}
                            >
                              Sì, rimborsa
                            </button>
                            <button
                              className="ao-btn-cancel-inline"
                              onClick={e => { e.stopPropagation(); setRefundConfirm(null); }}
                            >
                              No
                            </button>
                          </>
                        )}

                        {/* PENDING: cancel */}
                        {isPendingStatus(order.orderStatus) && (
                          <button
                            className="ao-btn-refund"
                            disabled={isLoading}
                            onClick={e => { e.stopPropagation(); handleUpdateStatus(order.orderId, "CANCELED"); }}
                          >
                            ↩ Annulla ordine
                          </button>
                        )}

                        {/* CANCELLED / COMPLETED: hard delete */}
                        {isClosedStatus(order.orderStatus) && (
                          <button
                            className="mo-delete-btn"
                            disabled={isLoading}
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                              setDeleteModal(true);
                            }}
                          >
                            🗑 Elimina
                          </button>
                        )}

                        {/* Inline feedback */}
                        {feedback && (
                          <span className={`ao-action-feedback${feedback.ok ? " ao-action-feedback--ok" : " ao-action-feedback--err"}`}>
                            {feedback.msg}
                          </span>
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

      <DeleteOrderModal
        show={deleteModal}
        onHide={() => setDeleteModal(false)}
        order={selectedOrder}
        onConfirm={handleDeleteConfirm}
        isAdmin={true}
      />
    </div>
  );
};

export default AllOrders;
