import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "react-bootstrap";
import {
  fetchNotifications,
  markNotifAsRead,
  markAllNotifsAsRead,
  fetchUnreadNotifCount,
  deleteNotification,
  deleteStalePastNotifications,
} from "../../api/modules/notifications.api";
import "../../styles/pages/_notifiche.css";
import SEO from "../../components/common/SEO";

// ─── Config ──────────────────────────────────────────────────────────────────

const STALE_DAYS = 60; // notifiche passate > 60 giorni → nascoste di default

const TYPE_CONFIG = {
  NEW_BOOKING: { icon: "🗓", label: "Nuova prenotazione", color: "#2d6a4f", link: "/profilo/admin/agenda" },
  BOOKING_CANCELLED: { icon: "✕", label: "Cancellazione", color: "#c0392b", link: "/profilo/admin/agenda" },
  NO_SHOW: { icon: "👻", label: "No-show", color: "#b8976a", link: "/profilo/admin/agenda" },
  BOOKING_MODIFIED: { icon: "✏️", label: "Modifica prenotazione", color: "#2e6da4", link: "/profilo/admin/agenda" },
  NEW_ORDER: { icon: "📦", label: "Nuovo ordine", color: "#2e6da4", link: "/profilo/admin/prodotti" },
  ORDER_CANCELLED: { icon: "📦", label: "Ordine cancellato", color: "#c0392b", link: "/profilo/admin/prodotti" },
};

// ─── Utilities ───────────────────────────────────────────────────────────────

const startOfDay = (d = new Date()) => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return "Adesso";
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  if (diff < 172800) return "Ieri";
  return new Date(isoString).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function isUrgent(n) {
  const ref = n.referenceDate ? new Date(n.referenceDate) : null;
  if (!ref) return false;
  const hoursUntil = (ref - Date.now()) / 36e5;
  return hoursUntil >= 0 && hoursUntil <= 48;
}

function isStale(n) {
  const ref = n.referenceDate ? new Date(n.referenceDate) : new Date(n.createdAt);
  const daysPast = (Date.now() - ref) / 864e5;
  return daysPast > STALE_DAYS;
}

/**
 * Raggruppa le notifiche in modo smart:
 *  - Urgenti (evento entro 48h)
 *  - Oggi
 *  - Questa settimana
 *  - [Mese Anno] per mesi futuri  ← nuovo
 *  - Passate (collassabile, auto-pulizia oltre STALE_DAYS)
 */
function smartGroup(items) {
  const todayStart = startOfDay();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(todayStart.getDate() + 7);

  const buckets = new Map();
  const add = (key, label, notif, order, isPast = false) => {
    if (!buckets.has(key)) buckets.set(key, { key, label, items: [], order, isPast });
    buckets.get(key).items.push(notif);
  };

  items.forEach(n => {
    // Usa referenceDate (data appuntamento) se presente, altrimenti createdAt
    const ref = n.referenceDate ? new Date(n.referenceDate) : new Date(n.createdAt);
    const refDay = startOfDay(ref);

    if (isUrgent(n)) {
      add("urgent", "⚡ Urgenti – entro 48 ore", n, -1);
    } else if (refDay >= tomorrowStart && refDay < weekEnd) {
      add("week", "Questa settimana", n, 1);
    } else if (refDay >= weekEnd) {
      // Raggruppa per mese dell'appuntamento
      const y = refDay.getFullYear();
      const mo = refDay.getMonth();
      const key = `future-${y}-${mo}`;
      const raw = new Date(y, mo, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      add(key, label, n, 100 + y * 12 + mo);
    } else if (refDay >= todayStart) {
      add("today", "Oggi", n, 0);
    } else {
      add("past", "Passate", n, 999, true);
    }
  });

  return [...buckets.values()].sort((a, b) => a.order - b.order);
}

// ─── NotifCard ───────────────────────────────────────────────────────────────

function NotifCard({ notif, onRead, onDelete }) {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[notif.type] || { icon: "●", label: notif.type, color: "#888", link: "#" };
  const urgent = isUrgent(notif);
  const stale = isStale(notif);

  const handleClick = async () => {
    if (!notif.read) await onRead(notif.id);
    if (cfg.link !== "#") navigate(cfg.link);
  };

  const handleDelete = async e => {
    e.stopPropagation();
    await onDelete(notif.id);
  };

  // Data appuntamento formattata se disponibile
  const apptDate = notif.referenceDate ? new Date(notif.referenceDate).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }) : null;

  return (
    <div
      className={["nf-card", notif.read ? "nf-card--read" : "nf-card--unread", urgent ? "nf-card--urgent" : "", stale ? "nf-card--stale" : ""].join(" ")}
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
          <span className="nf-card__label" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {urgent && !notif.read && <span className="nf-card__urgent-badge">OGGI / DOMANI</span>}
          {!notif.read && <span className="nf-card__dot" />}
        </div>
        <div className="nf-card__title">{notif.title}</div>
        {notif.body && <div className="nf-card__body">{notif.body}</div>}
        {apptDate && (
          <div className="nf-card__appt-date">
            <span className="nf-card__appt-icon">📅</span> {apptDate}
          </div>
        )}
      </div>

      <div className="nf-card__side">
        <div className="nf-card__time">{timeAgo(notif.createdAt)}</div>
        <button className="nf-card__delete" title="Rimuovi notifica" onClick={handleDelete} aria-label="Elimina notifica">
          ×
        </button>
      </div>
    </div>
  );
}

// ─── GroupSection ─────────────────────────────────────────────────────────────

function GroupSection({ group, onRead, onDelete, showStale, staleCount }) {
  const [collapsed, setCollapsed] = useState(group.isPast);

  const visible = useMemo(() => {
    if (!group.isPast) return group.items;
    return showStale ? group.items : group.items.filter(n => !isStale(n));
  }, [group, showStale]);

  if (visible.length === 0 && !group.isPast) return null;

  const unread = group.items.filter(n => !n.read).length;

  return (
    <div className={`nf-group ${group.isPast ? "nf-group--past" : ""} ${group.key === "urgent" ? "nf-group--urgent" : ""}`}>
      <button
        className="nf-group__header"
        onClick={() => group.isPast && setCollapsed(c => !c)}
        style={{ cursor: group.isPast ? "pointer" : "default" }}
        aria-expanded={!collapsed}
      >
        <div className="nf-group__label-row">
          <span className="nf-group__label">{group.label}</span>
          {unread > 0 && <span className="nf-group__badge">{unread}</span>}
          {group.isPast && staleCount > 0 && <span className="nf-group__stale-hint">{staleCount} scadute</span>}
        </div>
        {group.isPast && <span className="nf-group__chevron">{collapsed ? "›" : "‹"}</span>}
      </button>

      {(!group.isPast || !collapsed) && (
        <div className="nf-group__list">
          {visible.map(n => (
            <NotifCard key={n.id} notif={n} onRead={onRead} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotifichePage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all"); // all | unread | future
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [showStale, setShowStale] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [page, count] = await Promise.all([fetchNotifications(0, 200), fetchUnreadNotifCount()]);
      setNotifications(page.content ?? []);
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRead = useCallback(async id => {
    await markNotifAsRead(id);
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const handleDelete = useCallback(async id => {
    try {
      await deleteNotification(id);
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.read) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n.id !== id);
      });
    } catch {
      // se l'endpoint non esiste ancora, rimuovi solo localmente
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
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

  // Pulizia automatica: elimina notifiche passate oltre STALE_DAYS
  const handleCleanStale = async () => {
    setCleaning(true);
    try {
      await deleteStalePastNotifications(STALE_DAYS);
      // rimuovi localmente le stale
      setNotifications(prev => {
        const removed = prev.filter(n => {
          const ref = n.referenceDate ? new Date(n.referenceDate) : new Date(n.createdAt);
          const isPast = ref < new Date();
          return isPast && (Date.now() - ref) / 864e5 > STALE_DAYS;
        });
        const removedUnread = removed.filter(n => !n.read).length;
        setUnreadCount(c => Math.max(0, c - removedUnread));
        return prev.filter(n => !removed.includes(n));
      });
    } finally {
      setCleaning(false);
    }
  };

  // Filtra in base al tab attivo
  const visible = useMemo(() => {
    if (filter === "unread") return notifications.filter(n => !n.read);
    if (filter === "future")
      return notifications.filter(n => {
        const ref = n.referenceDate ? new Date(n.referenceDate) : null;
        return ref && ref > new Date();
      });
    return notifications;
  }, [notifications, filter]);

  const groups = useMemo(() => smartGroup(visible), [visible]);
  const staleCount = useMemo(() => notifications.filter(isStale).length, [notifications]);
  const urgentCount = useMemo(() => visible.filter(isUrgent).length, [visible]);
  const futureCount = useMemo(
    () =>
      notifications.filter(n => {
        const ref = n.referenceDate ? new Date(n.referenceDate) : null;
        return ref && ref > new Date();
      }).length,
    [notifications],
  );

  return (
    <div className="nf-page">
      <SEO title="Notifiche" description="Centro notifiche amministrativo Beauty Room." noindex={true} />
      <Container fluid="xl">
        {/* Header */}
        <div className="nf-header">
          <div>
            <span className="section-eyebrow">Pannello Admin</span>
            <h1 className="nf-title">Notifiche</h1>
            <p className="nf-subtitle">
              {unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? "nuova" : "nuove"} da leggere` : "Tutto aggiornato"}
              {urgentCount > 0 && (
                <span className="nf-subtitle__urgent">
                  {" "}
                  · ⚡ {urgentCount} urgent{urgentCount === 1 ? "e" : "i"}
                </span>
              )}
            </p>
          </div>
          <div className="nf-header__actions">
            {staleCount > 0 && (
              <button
                className="nf-btn nf-btn--clean"
                onClick={handleCleanStale}
                disabled={cleaning}
                title={`Rimuovi ${staleCount} notifiche passate da più di ${STALE_DAYS} giorni`}
              >
                {cleaning ? "…" : `🧹 Pulisci vecchie (${staleCount})`}
              </button>
            )}
            {unreadCount > 0 && (
              <button className="nf-btn nf-btn--markall" onClick={handleMarkAll} disabled={marking}>
                {marking ? "…" : "✓ Segna tutte lette"}
              </button>
            )}
          </div>
        </div>

        {/* Filtri */}
        <div className="nf-filters">
          {[
            { key: "all", label: "Tutte", count: notifications.length },
            { key: "unread", label: "Non lette", count: unreadCount, red: true },
            { key: "future", label: "Future", count: futureCount },
          ].map(tab => (
            <button key={tab.key} className={`nf-filter-tab ${filter === tab.key ? "is-active" : ""}`} onClick={() => setFilter(tab.key)}>
              {tab.label}
              {tab.count > 0 && <span className={`nf-filter-count ${tab.red && tab.count > 0 ? "nf-filter-count--red" : ""}`}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Contenuto */}
        {loading ? (
          <div className="nf-empty">
            <div className="nf-loading-shimmer">
              {[1, 2, 3].map(i => (
                <div key={i} className="nf-shimmer-card" />
              ))}
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div className="nf-empty">
            <div className="nf-empty__icon">{filter === "unread" ? "✅" : filter === "future" ? "📭" : "🎉"}</div>
            <p className="nf-empty__title">
              {filter === "unread" ? "Nessuna notifica non letta" : filter === "future" ? "Nessuna prenotazione futura" : "Tutto in ordine!"}
            </p>
            <p className="nf-empty__text">
              {filter === "unread"
                ? "Sei aggiornata su tutto."
                : filter === "future"
                  ? "Nessuna prenotazione futura ricevuta."
                  : "Le notifiche arriveranno quando i clienti prenoteranno online."}
            </p>
          </div>
        ) : (
          <>
            {groups.map(group => (
              <GroupSection
                key={group.key}
                group={group}
                onRead={handleRead}
                onDelete={handleDelete}
                showStale={showStale}
                staleCount={group.isPast ? staleCount : 0}
              />
            ))}

            {/* Toggle notifiche stantie nelle Passate */}
            {staleCount > 0 && groups.some(g => g.isPast) && (
              <div className="nf-stale-toggle">
                <button className="nf-stale-toggle__btn" onClick={() => setShowStale(s => !s)}>
                  {showStale ? `Nascondi vecchie (${staleCount})` : `Mostra vecchie (${staleCount}) · oltre ${STALE_DAYS} giorni`}
                </button>
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  );
}
