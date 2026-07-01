import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Container, Spinner } from "react-bootstrap";
import { fetchPostIts, createPostIt, updatePostIt, togglePostItDone, deletePostIt } from "../../../api/modules/postits.api";
import DateTimeField from "../../../components/common/DateTimeField";
import "../../../styles/pages/_postit.css";

const PALETTE = [
  { hex: "#b8976a", name: "Oro" },
  { hex: "#8c6d3f", name: "Mogano" },
  { hex: "#d4a373", name: "Sabbia" },
  { hex: "#6d4c41", name: "Cacao" },
  { hex: "#5c7c5e", name: "Salvia" },
  { hex: "#7b6fa8", name: "Lavanda" },
  { hex: "#c0665e", name: "Rosa antico" },
  { hex: "#4a7fa5", name: "Petrolio" },
];

// Priority (0–3) → subtle left-edge accent: neutral gold at 0, warming to red at 3.
// Purely decorative and derived; never disturbs the user-chosen note colour (--note-color).
const PRIO_COLORS = ["#b8976a", "#c58a4a", "#cf6a3a", "#c0392b"];

const isExpiring = dueDate => {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  const diff = due - new Date();
  return diff >= 0 && diff <= 86400000 * 2;
};

const isOverdue = dueDate => {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
};

const fmtDate = iso => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Snooze: push the due date forward N days from today (noon-anchored to dodge DST/
// midnight edges), returned as the "YYYY-MM-DD" string the DTO/DateTimeField use.
const dateInDays = days => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const EMPTY_FORM = { title: "", description: "", color: "#b8976a", dueDate: "", priority: 0 };

/**
 * Post-it board as a shell-less panel mounted inside AdminWorkspace (the 3rd view).
 * No full-page/viewport-height wrapper — it inherits the workspace height. The drawer
 * + overlay are portaled to document.body so their position:fixed stays anchored to
 * the viewport regardless of any transformed/filtered ancestor. `onMutate` lets the
 * parent refresh the tab's overdue badge after any create/toggle/delete/snooze.
 */
export default function PostItPanel({ onMutate }) {
  const [postIts, setPostIts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [filter, setFilter] = useState("active");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const data = await fetchPostIts();
      setPostIts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEdit = note => {
    setEditingId(note.id);
    setForm({
      title: note.title || "",
      description: note.description || "",
      color: note.color || "#b8976a",
      dueDate: note.dueDate || "",
      priority: note.priority || 0,
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError("Il titolo è obbligatorio.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const dto = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        color: form.color,
        dueDate: form.dueDate || null,
        priority: Number(form.priority) || 0,
      };
      if (editingId) {
        const updated = await updatePostIt(editingId, dto);
        setPostIts(prev => prev.map(p => (p.id === editingId ? updated : p)));
      } else {
        const created = await createPostIt(dto);
        setPostIts(prev => [created, ...prev]);
      }
      setDrawerOpen(false);
      onMutate?.();
    } catch (err) {
      setFormError(err.message || "Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async note => {
    try {
      const updated = await togglePostItDone(note.id);
      setPostIts(prev => prev.map(p => (p.id === note.id ? updated : p)));
      onMutate?.();
    } catch {
      /* best-effort: keep current state on failure */
    }
  };

  const handleDelete = async id => {
    if (!confirm("Eliminare questo post-it?")) return;
    try {
      await deletePostIt(id);
      setPostIts(prev => prev.filter(p => p.id !== id));
      onMutate?.();
    } catch {
      /* best-effort: keep current state on failure */
    }
  };

  const handleSnooze = async (note, days) => {
    const dto = {
      title: note.title,
      description: note.description ?? null,
      color: note.color,
      dueDate: dateInDays(days),
      priority: note.priority ?? 0,
    };
    try {
      const updated = await updatePostIt(note.id, dto);
      setPostIts(prev => prev.map(p => (p.id === note.id ? updated : p)));
      onMutate?.();
    } catch {
      /* best-effort: keep current state on failure */
    }
  };

  const filtered = postIts.filter(p => {
    if (filter === "active") return !p.done;
    if (filter === "done") return p.done;
    return true;
  });

  const expiringCount = postIts.filter(p => !p.done && (isExpiring(p.dueDate) || isOverdue(p.dueDate))).length;

  if (loading)
    return (
      <div className="pib-panel">
        <Container className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </Container>
      </div>
    );

  return (
    <div className="pib-panel">
      <Container fluid="xl">
        {/* HEADER */}
        <div className="pib-header">
          <div>
            <span className="section-eyebrow">Lavagna</span>
            <h1 className="pib-title">Post-it</h1>
            {expiringCount > 0 && (
              <div className="pib-expiring-alert">
                ⚠️ {expiringCount} nota{expiringCount > 1 ? " in scadenza o scadute" : " in scadenza o scaduta"}
              </div>
            )}
          </div>
          <button className="pib-add-btn" onClick={openCreate}>
            + Nuova nota
          </button>
        </div>

        {/* FILTRI */}
        <div className="pib-filters">
          {["active", "all", "done"].map(f => (
            <button key={f} className={`pib-filter${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
              {f === "active"
                ? `Attive (${postIts.filter(p => !p.done).length})`
                : f === "done"
                  ? `Completate (${postIts.filter(p => p.done).length})`
                  : `Tutte (${postIts.length})`}
            </button>
          ))}
        </div>

        {error && <p className="text-danger">{error}</p>}

        {/* BOARD */}
        {filtered.length === 0 ? (
          <div className="pib-empty">
            <div className="pib-empty-icon">✦</div>
            <p>Nessuna nota</p>
            {filter === "active" && (
              <button className="pib-add-btn pib-add-btn--outline" onClick={openCreate}>
                Aggiungi la prima nota
              </button>
            )}
          </div>
        ) : (
          <div className="pib-grid">
            {filtered.map(note => {
              const overdue = isOverdue(note.dueDate) && !note.done;
              const expiring = isExpiring(note.dueDate) && !note.done && !overdue;
              const needsAttention = overdue || expiring;
              return (
                <div
                  key={note.id}
                  className={`pib-note${note.done ? " pib-note--done" : ""}${overdue ? " pib-note--overdue" : ""}${expiring ? " pib-note--expiring" : ""}`}
                  style={{ "--note-color": note.color, "--prio-color": PRIO_COLORS[Math.min(note.priority || 0, 3)] }}
                >
                  <div className="pib-note-hole" />
                  <div className="pib-note-band" />

                  {note.priority > 0 && <div className="pib-note-priority">{"★".repeat(Math.min(note.priority, 3))}</div>}

                  <div className="pib-note-body">
                    <h3 className="pib-note-title">{note.title}</h3>
                    {note.description && <p className="pib-note-desc">{note.description}</p>}
                  </div>

                  <div className="pib-note-footer">
                    {needsAttention && (
                      <div className="pib-note-snooze">
                        <button
                          className="pib-chip"
                          onClick={e => {
                            e.stopPropagation();
                            handleSnooze(note, 1);
                          }}
                          title="Sposta a domani"
                        >
                          Domani
                        </button>
                        <button
                          className="pib-chip"
                          onClick={e => {
                            e.stopPropagation();
                            handleSnooze(note, 7);
                          }}
                          title="Rinvia di 7 giorni"
                        >
                          +7g
                        </button>
                      </div>
                    )}

                    <div className="pib-note-actions">
                      {note.dueDate && (
                        <div className={`pib-note-due${overdue ? " pib-note-due--overdue" : expiring ? " pib-note-due--expiring" : ""}`}>
                          {overdue ? "⚠️ Scaduto" : expiring ? `⏰ Scade il ${fmtDate(note.dueDate)}` : `📅 Scade il ${fmtDate(note.dueDate)}`}
                          {overdue && <span className="pib-note-due-date"> · {fmtDate(note.dueDate)}</span>}
                        </div>
                      )}
                      <div className="pib-note-actions-buttons">
                        <button
                          className={`pib-note-done-btn${note.done ? " done" : ""}`}
                          onClick={() => handleToggleDone(note)}
                          title={note.done ? "Riapri" : "Segna come fatto"}
                        >
                          {note.done ? "↩" : "✓"}
                        </button>
                        <button className="pib-note-edit-btn" onClick={() => openEdit(note)} title="Modifica">
                          ✎
                        </button>
                        <button className="pib-note-del-btn" onClick={() => handleDelete(note.id)} title="Elimina">
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Container>

      {/* DRAWER — portaled to document.body so position:fixed is never captured by a
          transformed/filtered ancestor (the workspace fade is opacity-only, but this
          keeps the drawer bulletproof regardless of where the panel is mounted). */}
      {drawerOpen &&
        createPortal(
          <>
            <div className="pib-drawer-overlay" onClick={() => setDrawerOpen(false)} />
            <div className="pib-drawer">
              <div className="pib-drawer-header">
                <h3 className="pib-drawer-title">{editingId ? "Modifica nota" : "Nuova nota"}</h3>
                <button className="pib-drawer-close" onClick={() => setDrawerOpen(false)}>
                  ×
                </button>
              </div>

              <div className="pib-drawer-body">
                {formError && <div className="pib-form-error">{formError}</div>}

                <div className="pib-form-field">
                  <label className="pib-form-label">Titolo *</label>
                  <input
                    className="pib-form-input"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Es. Chiamare fornitore..."
                    maxLength={200}
                  />
                </div>

                <div className="pib-form-field">
                  <label className="pib-form-label">Descrizione</label>
                  <textarea
                    className="pib-form-input pib-form-textarea"
                    rows={4}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Dettagli, note, promemoria..."
                  />
                </div>

                <div className="pib-form-row">
                  <div className="pib-form-field pib-form-field--dtf">
                    <DateTimeField
                      label="Scadenza"
                      mode="date"
                      value={form.dueDate}
                      onChange={v => setForm(f => ({ ...f, dueDate: v }))}
                      placeholder="Seleziona data"
                      className="pib-dtf"
                    />
                  </div>
                  <div className="pib-form-field">
                    <label className="pib-form-label">Priorità</label>
                    <div className="pib-priority-stars">
                      {[0, 1, 2, 3].map(n => (
                        <button
                          key={n}
                          type="button"
                          className={`pib-star${form.priority >= n && n > 0 ? " active" : ""}`}
                          onClick={() => setForm(f => ({ ...f, priority: f.priority === n ? 0 : n }))}
                        >
                          {n === 0 ? "✦" : "★"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pib-form-field">
                  <label className="pib-form-label">Colore nota</label>
                  <div className="pib-color-picker">
                    {PALETTE.map(c => (
                      <button
                        key={c.hex}
                        type="button"
                        className={`pib-color-swatch${form.color === c.hex ? " active" : ""}`}
                        style={{ background: c.hex }}
                        title={c.name}
                        onClick={() => setForm(f => ({ ...f, color: c.hex }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="pib-preview" style={{ "--note-color": form.color }}>
                  <div className="pib-note-band" />
                  <div className="pib-note-body">
                    <h3 className="pib-note-title">{form.title || "Titolo nota"}</h3>
                    {form.description && <p className="pib-note-desc">{form.description}</p>}
                  </div>
                </div>
              </div>

              <div className="pib-drawer-footer">
                <button className="pib-btn pib-btn--ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
                  Annulla
                </button>
                <button className="pib-btn pib-btn--primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner size="sm" animation="border" /> : editingId ? "Salva modifiche" : "Crea nota"}
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
