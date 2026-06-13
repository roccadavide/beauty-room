import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  createPackageInstallment,
  deletePackageInstallment,
  getPackageInstallments,
  getPackageInstallmentSummary,
  settlePackageInstallment,
  unsettlePackageInstallment,
  updatePackageInstallment,
} from "../../../api/modules/adminAgenda.api";
import { formatEuro } from "../../../utils/formatEuro";
import ConfirmDialog from "../../common/ConfirmDialog";
import DateTimeField, { toISODateLocal } from "../../common/DateTimeField";

// "Today" as YYYY-MM-DD from LOCAL parts (never toISOString) — same as the rest
// of the codebase. toISODateLocal lives in DateTimeField and does exactly this.
const today = () => toISODateLocal(new Date());

// YYYY-MM-DD -> gg/mm/aaaa, parsed by parts so there is no timezone drift.
const fmtDate = iso => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

const EMPTY_FORM = { amount: "", dueDate: "", dateTbd: false, paid: false, paidDate: "", paymentMethod: "", note: "" };

const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1058, // above the NewAppointmentDrawer panel (1050), below ConfirmDialog (1060)
    background: "rgba(20, 12, 6, 0.55)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "max(4vh, 16px) 16px",
    overflowY: "auto",
  },
  panel: {
    width: "100%",
    maxWidth: 560,
    background: "#fffaf3",
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(46, 33, 24, 0.28)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "16px 18px",
    borderBottom: "1px solid rgba(184, 151, 106, 0.25)",
  },
  title: { fontSize: "1.02rem", fontWeight: 700, color: "#5a4030" },
  close: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "1.1rem",
    color: "#8c6d3f",
    lineHeight: 1,
    padding: 4,
  },
  body: { padding: 18, display: "flex", flexDirection: "column", gap: 12 },
  summary: {
    background: "rgba(184, 151, 106, 0.10)",
    border: "1px solid rgba(184, 151, 106, 0.4)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: "0.88rem",
    color: "#5a4632",
  },
  summaryMuted: { color: "#8a7a64" },
  summaryNext: { marginTop: 4, fontSize: "0.82rem", color: "#8c6d3f", fontWeight: 600 },
  list: { display: "flex", flexDirection: "column", gap: 8, maxHeight: "40vh", overflowY: "auto" },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    padding: "8px 10px",
    border: "1px solid rgba(184, 151, 106, 0.22)",
    borderRadius: 10,
    background: "#fff",
  },
  rowMain: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 },
  amount: { fontWeight: 700, color: "#3a2e22", fontSize: "0.95rem" },
  rowActions: { display: "flex", alignItems: "center", gap: 6 },
  iconBtn: {
    border: "1px solid rgba(184, 151, 106, 0.3)",
    background: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
    lineHeight: 1,
    padding: "5px 8px",
    borderRadius: 8,
  },
  overdue: {
    background: "rgba(248, 113, 113, 0.14)",
    color: "#c0392b",
    border: "1px solid rgba(248, 113, 113, 0.4)",
    fontWeight: 600,
  },
  form: {
    border: "1px solid rgba(184, 151, 106, 0.4)",
    borderRadius: 12,
    padding: 14,
    background: "rgba(184, 151, 106, 0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  formTitle: { fontWeight: 700, color: "#5a4030", fontSize: "0.92rem" },
  label: { display: "block", marginBottom: 4 },
  check: { display: "flex", alignItems: "center", gap: 8, fontSize: "0.86rem", color: "#5a4030", cursor: "pointer" },
  paidBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingLeft: 10,
    borderLeft: "3px solid rgba(184, 151, 106, 0.45)",
  },
  formActions: { display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 2 },
  muted: { fontSize: "0.85rem", color: "#8a7a64" },
  // "Da definire" status pill — neutral, muted, italic (never overdue-styled).
  tbd: {
    background: "rgba(184, 151, 106, 0.10)",
    color: "#8a7a64",
    border: "1px solid rgba(184, 151, 106, 0.3)",
    fontStyle: "italic",
    fontWeight: 600,
  },
};

export default function InstallmentEditor({ assignmentId, packageName, onClose, onChanged }) {
  const [installments, setInstallments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = add, id = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null); // installment | null

  // ── Load list + summary in parallel (on mount and after every mutation) ─────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, sum] = await Promise.all([getPackageInstallments(assignmentId), getPackageInstallmentSummary(assignmentId)]);
      setInstallments(Array.isArray(list) ? list : []);
      setSummary(sum || null);
    } catch (err) {
      setError(err.message || "Errore caricamento rate.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  // Don't tear the modal down mid-save; let ConfirmDialog own Escape when it's up.
  const requestClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    const onKey = e => {
      if (e.key !== "Escape") return;
      if (confirmDelete) return; // ConfirmDialog handles its own Escape
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete, requestClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Form open helpers ───────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    // Prefill the common "next rata = what's left" case.
    setForm({ ...EMPTY_FORM, amount: summary?.remaining > 0 ? String(summary.remaining) : "" });
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = inst => {
    setEditingId(inst.id);
    setForm({
      amount: inst.amount != null ? String(inst.amount) : "",
      dueDate: inst.dueDate || "",
      // A date-less rata opens with "da definire" pre-checked (Data cleared).
      dateTbd: !inst.dueDate,
      paid: !!inst.paid,
      paidDate: inst.paidDate || (inst.paid ? today() : ""),
      paymentMethod: inst.paymentMethod || "",
      note: inst.note || "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const togglePaid = checked => {
    setForm(f => ({ ...f, paid: checked, paidDate: checked && !f.paidDate ? today() : f.paidDate }));
  };

  // ── Mutations ───────────────────────────────────────────────────────────────
  const afterMutation = async () => {
    await load();
    onChanged?.();
  };

  const submitForm = async () => {
    const amountNum = Number(form.amount);
    if (!form.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      setFormError("Inserisci un importo maggiore di 0.");
      return;
    }
    if (!form.dateTbd && !form.dueDate) {
      setFormError("Seleziona una data di scadenza oppure attiva «Data da definire».");
      return;
    }
    const body = {
      amount: amountNum,
      // "Da definire" → send null (the backend field is nullable/un-required), not "".
      dueDate: form.dateTbd ? null : form.dueDate,
      paid: form.paid,
      paidDate: form.paid ? form.paidDate || today() : null,
      paymentMethod: form.paid ? form.paymentMethod.trim() || null : null,
      note: form.note.trim() || null,
    };
    setSubmitting(true);
    setFormError("");
    try {
      if (editingId) await updatePackageInstallment(assignmentId, editingId, body);
      else await createPackageInstallment(assignmentId, body);
      setFormOpen(false);
      await afterMutation();
    } catch (err) {
      setFormError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async fn => {
    setSubmitting(true);
    setError("");
    try {
      await fn();
      await afterMutation();
    } catch (err) {
      setError(err.message || "Operazione non riuscita.");
    } finally {
      setSubmitting(false);
    }
  };

  const doSettle = inst => runAction(() => settlePackageInstallment(assignmentId, inst.id, { paidDate: today() }));
  const doUnsettle = inst => runAction(() => unsettlePackageInstallment(assignmentId, inst.id));

  const doDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    await runAction(() => deletePackageInstallment(assignmentId, target.id));
  };

  // ── Derived summary bits ────────────────────────────────────────────────────
  const t = today();
  const nextInst = summary?.nextDueDate ? installments.find(i => !i.paid && i.dueDate === summary.nextDueDate) : null;

  const renderStatus = inst => {
    if (inst.paid) {
      return (
        <span className="ag-pill ag-pill--paid">
          ✓ Pagata il {fmtDate(inst.paidDate)}
          {inst.paymentMethod ? ` · ${inst.paymentMethod}` : ""}
        </span>
      );
    }
    // Date-less ("da definire") rata: neutral muted label — never a date, never overdue.
    if (!inst.dueDate) {
      return (
        <span className="ag-pill" style={S.tbd}>
          Da definire
        </span>
      );
    }
    if (inst.dueDate < t) {
      return (
        <span className="ag-pill" style={S.overdue}>
          ⚠️ Scaduta il {fmtDate(inst.dueDate)}
        </span>
      );
    }
    return <span className="ag-pill ag-pill--unpaid">Da incassare il {fmtDate(inst.dueDate)}</span>;
  };

  return createPortal(
    <div style={S.backdrop} onClick={requestClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={S.header}>
          <div style={S.title}>📅 Piano rate — {packageName}</div>
          <button type="button" style={S.close} onClick={requestClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div style={S.body}>
          {/* Summary bar */}
          {summary && (
            <div style={S.summary}>
              <div>
                Incassato <strong>{formatEuro(summary.collected)}</strong> di {formatEuro(summary.total)} · Residuo{" "}
                <strong>{formatEuro(summary.remaining)}</strong>
                {summary.unscheduled ? <span style={S.summaryMuted}> · da pianificare {formatEuro(summary.unscheduled)}</span> : null}
              </div>
              {summary.nextDueDate && (
                <div style={S.summaryNext}>
                  {nextInst ? `Prossima: ${formatEuro(nextInst.amount)} il ${fmtDate(summary.nextDueDate)}` : `Prossima il ${fmtDate(summary.nextDueDate)}`}
                </div>
              )}
            </div>
          )}

          {error && <div className="nad-form__error">{error}</div>}
          {loading && <div style={S.muted}>Carico…</div>}

          {/* List */}
          {!loading && installments.length === 0 && <div style={S.muted}>Nessuna rata ancora pianificata.</div>}
          {installments.length > 0 && (
            <div style={S.list}>
              {installments.map(inst => (
                <div key={inst.id} style={S.row}>
                  <div style={S.rowMain}>
                    <span style={S.amount}>{formatEuro(inst.amount)}</span>
                    {renderStatus(inst)}
                  </div>
                  <div style={S.rowActions}>
                    {inst.paid ? (
                      <button type="button" className="ag-pill ag-pill--toggle" disabled={submitting} onClick={() => doUnsettle(inst)}>
                        Annulla saldo
                      </button>
                    ) : (
                      <button type="button" className="ag-pill ag-pill--toggle" disabled={submitting} onClick={() => doSettle(inst)}>
                        Salda
                      </button>
                    )}
                    <button type="button" style={S.iconBtn} disabled={submitting} onClick={() => openEdit(inst)} aria-label="Modifica rata">
                      ✏
                    </button>
                    <button type="button" style={S.iconBtn} disabled={submitting} onClick={() => setConfirmDelete(inst)} aria-label="Elimina rata">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add / edit inline form */}
          {formOpen ? (
            <div style={S.form}>
              <div style={S.formTitle}>{editingId ? "Modifica rata" : "Nuova rata"}</div>

              <div>
                <label className="nad-form__label" style={S.label}>
                  Importo (€) *
                </label>
                <input
                  className="nad-form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00"
                />
              </div>

              {!form.dateTbd && (
                <DateTimeField label="Scadenza *" mode="date" value={form.dueDate} onChange={v => setForm(f => ({ ...f, dueDate: v }))} />
              )}

              <label style={S.check}>
                <input type="checkbox" checked={form.dateTbd} onChange={e => setForm(f => ({ ...f, dateTbd: e.target.checked }))} />
                <span>📌 Data da definire</span>
              </label>
              {form.dateTbd && <div style={S.muted}>La rata ricomparirà al prossimo appuntamento di questa cliente per questo pacchetto.</div>}

              <div>
                <label className="nad-form__label" style={S.label}>
                  Note
                </label>
                <input
                  className="nad-form__input"
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="(facoltativo)"
                  maxLength={200}
                />
              </div>

              <label style={S.check}>
                <input type="checkbox" checked={form.paid} onChange={e => togglePaid(e.target.checked)} />
                <span>Già pagata</span>
              </label>

              {form.paid && (
                <div style={S.paidBlock}>
                  <DateTimeField label="Pagata il" mode="date" value={form.paidDate} onChange={v => setForm(f => ({ ...f, paidDate: v }))} />
                  <div>
                    <label className="nad-form__label" style={S.label}>
                      Metodo
                    </label>
                    <input
                      className="nad-form__input"
                      type="text"
                      value={form.paymentMethod}
                      onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                      placeholder="Contanti, carta…"
                    />
                  </div>
                </div>
              )}

              {formError && <div className="nad-form__error">{formError}</div>}

              <div style={S.formActions}>
                <button type="button" className="nad-btn" disabled={submitting} onClick={() => setFormOpen(false)}>
                  Annulla
                </button>
                <button type="button" className="nad-btn nad-btn--primary" disabled={submitting} onClick={submitForm}>
                  {submitting ? "Salvo…" : editingId ? "Salva" : "Aggiungi"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="nad-btn nad-btn--primary" disabled={submitting || loading} onClick={openAdd}>
              + Aggiungi rata
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        show={!!confirmDelete}
        onHide={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Elimina rata"
        message={
          confirmDelete?.paid
            ? `Questa rata da ${formatEuro(confirmDelete?.amount)} risulta incassata: eliminandola rimuovi anche l'incasso registrato. Procedere?`
            : `Vuoi eliminare la rata da ${formatEuro(confirmDelete?.amount)}?`
        }
        confirmLabel="Elimina"
        confirmVariant="danger"
      />
    </div>,
    document.body,
  );
}
