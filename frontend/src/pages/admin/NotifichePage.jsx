import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "react-bootstrap";
import {
  fetchNotifications,
  markNotifAsRead,
  markAllNotifsAsRead,
  fetchUnreadNotifCount,
} from "../../api/modules/notifications.api";
import "../../styles/pages/_notifiche.css";

const TYPE_CONFIG = {
  NEW_BOOKING:       { icon: "🗓", label: "Nuova prenotazione", color: "#2d6a4f", link: "/profilo/admin/agenda" },
  BOOKING_CANCELLED: { icon: "✕",  label: "Cancellazione",      color: "#c0392b", link: "/profilo/admin/agenda" },
  NO_SHOW:           { icon: "👻", label: "No-show",             color: "#b8976a", link: "/profilo/admin/agenda" },
  NEW_ORDER:         { icon: "📦", label: "Nuovo ordine",        color: "#2e6da4", link: "/ordini/tutti"         },
  ORDER_CANCELLED:   { icon: "📦", label: "Ordine cancellato",   color: "#c0392b", link: "/ordini/tutti"         },
};

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60)     return "Adesso";
  if (diff < 3600)   return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h fa`;
  if (diff < 172800) return "Ieri";
  return new Date(isoString).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function groupByDate(items) {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo   = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const groups = { oggi: [], ieri: [], settimana: [], prima: [] };
  items.forEach(n => {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
    if      (d >= today)         groups.oggi.push(n);
    else if (d >= yesterday)     groups.ieri.push(n);
    else if (d >= weekAgo)       groups.settimana.push(n);
    else                         groups.prima.push(n);
  });
  return [
    { key: "oggi",      label: "Oggi",             items: groups.oggi },
    { key: "ieri",      label: "Ieri",             items: groups.ieri },
    { key: "settimana", label: "Questa settimana", items: groups.settimana },
    { key: "prima",     label: "Più vecchie",      items: groups.prima },
  ].filter(g => g.items.length > 0);
}

function NotifCard({ notif, onRead }) {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[notif.type] || { icon: "●", label: notif.type, color: "#888", link: "#" };

  const handleClick = async () => {
    if (!notif.read) await onRead(notif.id);
    navigate(cfg.link);
  };

  return (
    <div
      className={`nf-card ${notif.read ? "nf-card--read" : "nf-card--unread"}`}
      style={{ "--nf-accent": cfg.color }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && handleClick()}
    >
      <div className="nf-card__icon" style={{ background: cfg.color + "1a", color: cfg.color }}>
        {cfg.icon}
      </div>
      <div className="nf-card__content">
        <div className="nf-card__header">
          <span className="nf-card__label" style={{ color: cfg.color }}>{cfg.label}</span>
          {!notif.read && <span className="nf-card__dot" />}
        </div>
        <div className="nf-card__title">{notif.title}</div>
        {notif.body && <div className="nf-card__body">{notif.body}</div>}
      </div>
      <div className="nf-card__time">{timeAgo(notif.createdAt)}</div>
    </div>
  );
}

export default function NotifichePage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [filter, setFilter]               = useState("all");
  const [loading, setLoading]             = useState(true);
  const [marking, setMarking]             = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [page, count] = await Promise.all([
        fetchNotifications(0, 100),
        fetchUnreadNotifCount(),
      ]);
      setNotifications(page.content ?? []);
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRead = useCallback(async id => {
    await markNotifAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const handleMarkAll = async () => {
    setMarking(true);
    try {
      await markAllNotifsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setMarking(false);
    }
  };

  const visible = filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  const groups  = groupByDate(visible);

  return (
    <div className="nf-page">
      <Container fluid="xl">
        <div className="nf-header">
          <div>
            <span className="section-eyebrow">Pannello Admin</span>
            <h1 className="nf-title">Notifiche</h1>
            {unreadCount > 0 && (
              <p className="nf-subtitle">{unreadCount} {unreadCount === 1 ? "nuova" : "nuove"} da leggere</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button className="nf-btn-markall" onClick={handleMarkAll} disabled={marking}>
              {marking ? "…" : "✓ Segna tutte lette"}
            </button>
          )}
        </div>

        <div className="nf-filters">
          <button className={`nf-filter-tab ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>
            Tutte <span className="nf-filter-count">{notifications.length}</span>
          </button>
          <button className={`nf-filter-tab ${filter === "unread" ? "is-active" : ""}`} onClick={() => setFilter("unread")}>
            Non lette
            {unreadCount > 0 && <span className="nf-filter-count nf-filter-count--red">{unreadCount}</span>}
          </button>
        </div>

        {loading ? (
          <div className="nf-empty">
            <div className="nf-empty__icon">⏳</div>
            <p className="nf-empty__text">Caricamento…</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="nf-empty">
            <div className="nf-empty__icon">🎉</div>
            <p className="nf-empty__title">Tutto in ordine!</p>
            <p className="nf-empty__text">
              {filter === "unread"
                ? "Nessuna notifica non letta."
                : "Nessuna notifica ancora. Arriveranno quando i clienti prenoteranno online."}
            </p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.key} className="nf-group">
              <div className="nf-group__label">{group.label}</div>
              <div className="nf-group__list">
                {group.items.map(n => (
                  <NotifCard key={n.id} notif={n} onRead={handleRead} />
                ))}
              </div>
            </div>
          ))
        )}
      </Container>
    </div>
  );
}
