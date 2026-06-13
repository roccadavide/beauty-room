import { useCallback, useEffect, useState } from "react";
import { cancelPackageAssignment, getClientPackageAssignmentsByName } from "../../api/modules/adminAgenda.api";
import ConfirmDialog from "../common/ConfirmDialog";
import InstallmentEditor from "./installments/InstallmentEditor";
import PackageForm from "./PackageForm";

export default function PackagesTab({ customer, services = [], isOpen, onPackageCreated }) {
  const hasCustomer = !!customer?.fullName?.trim();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editingPackage, setEditingPackage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name } | null
  const [deleteError, setDeleteError] = useState("");
  const [rateEditorPkg, setRateEditorPkg] = useState(null); // ClientPackageAssignmentDTO | null

  // ── Load active packages for this customer ─────────────────────────────────
  const reload = useCallback(async () => {
    if (!hasCustomer) return;
    setLoading(true);
    setLoadError("");
    try {
      const list = await getClientPackageAssignmentsByName(customer.fullName.trim());
      setAssignments((list || []).filter(p => p.status === "ACTIVE"));
    } catch (err) {
      setLoadError(err.message || "Errore nel caricamento dei pacchetti.");
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [customer, hasCustomer]);

  // Trigger reload when the tab opens or the customer changes
  useEffect(() => {
    if (isOpen && hasCustomer) reload();
    if (!hasCustomer) {
      setAssignments([]);
      setEditingPackage(null);
    }
  }, [isOpen, hasCustomer, reload]);

  // ── Delete flow ────────────────────────────────────────────────────────────
  const executeDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      await cancelPackageAssignment(deleteConfirm.id);
      // If we were editing the one being deleted, drop the form into create mode
      if (editingPackage?.id === deleteConfirm.id) setEditingPackage(null);
      setDeleteConfirm(null);
      reload();
    } catch (err) {
      setDeleteError(err.message || "Errore durante la cancellazione.");
    }
  }, [deleteConfirm, editingPackage, reload]);

  // ── Form save callback ────────────────────────────────────────────────────
  const handleSaved = useCallback(() => {
    const wasEdit = editingPackage != null;
    setEditingPackage(null);
    reload();
    if (!wasEdit) onPackageCreated?.();
  }, [editingPackage, onPackageCreated, reload]);

  // ── Placeholder when no customer ───────────────────────────────────────────
  if (!hasCustomer) {
    return (
      <div className="nad-placeholder">
        <span className="nad-placeholder__icon">📦</span>
        <p className="nad-placeholder__text">Seleziona prima una cliente nella tab “Appuntamento”.</p>
      </div>
    );
  }

  return (
    <div className="pkgt">
      {/* ── Part A: active packages list ─────────────────────────────────── */}
      <div className="pkgt-section">
        <div className="pkgt-section__title">
          Pacchetti attivi di <strong>{customer.fullName}</strong>
        </div>

        {loading && <div className="nad-help">Carico…</div>}
        {loadError && <div className="nad-form__error">{loadError}</div>}
        {!loading && !loadError && assignments.length === 0 && (
          <div className="nad-help">Nessun pacchetto attivo. Creane uno qui sotto.</div>
        )}

        {assignments.map(pkg => {
          const sessionsUsed = pkg.totalSessions - pkg.sessionsRemaining;
          const sortedItems = Array.isArray(pkg.items) ? [...pkg.items].sort((a, b) => a.position - b.position) : [];
          const isBeingEdited = editingPackage?.id === pkg.id;
          return (
            <div key={pkg.id} className={`pkgt-card${isBeingEdited ? " is-editing" : ""}`}>
              <div className="pkgt-card__header">
                <div className="pkgt-card__name">
                  📦 {pkg.displayName || pkg.customPackageName || pkg.serviceTitle || "Pacchetto"}
                  {pkg.paidUpfront && <span className="pkgt-badge pkgt-badge--paid">pagato</span>}
                </div>
                <div className="pkgt-card__sessions">
                  Seduta {sessionsUsed + 1}/{pkg.totalSessions}
                  {pkg.sessionsRemaining === 1 && <span style={{ color: "#b8976a" }}> · ultima!</span>}
                </div>
              </div>

              {sortedItems.length > 0 && (
                <ul className="pkgt-card__items">
                  {sortedItems.map(it => (
                    <li key={it.id ?? it.position}>
                      {it.customName || it.serviceOptionName || it.serviceTitle || "—"}
                    </li>
                  ))}
                </ul>
              )}

              <div className="pkgt-card__actions">
                {pkg.paymentMode === "INSTALLMENTS" && (
                  <button
                    type="button"
                    className="pkgt-card__btn"
                    onClick={() => setRateEditorPkg(pkg)}
                    aria-label="Gestisci rate"
                  >
                    📅 Gestisci rate
                  </button>
                )}
                <button
                  type="button"
                  className="pkgt-card__btn"
                  onClick={() => setEditingPackage(pkg)}
                  disabled={isBeingEdited}
                  aria-label="Modifica pacchetto"
                >
                  ✏ {isBeingEdited ? "In modifica…" : "Modifica"}
                </button>
                <button
                  type="button"
                  className="pkgt-card__btn pkgt-card__btn--danger"
                  onClick={() => {
                    setDeleteError("");
                    setDeleteConfirm({ id: pkg.id, name: pkg.displayName || pkg.customPackageName || "Pacchetto" });
                  }}
                  aria-label="Elimina pacchetto"
                >
                  🗑 Elimina
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Part B: create/edit form ──────────────────────────────────────── */}
      <div className="pkgt-section">
        <div className="pkgt-section__title">
          {editingPackage ? (
            <>
              Modifica pacchetto
              <button type="button" className="pkgt-cancel-edit" onClick={() => setEditingPackage(null)}>
                Annulla modifica
              </button>
            </>
          ) : (
            "Crea nuovo pacchetto"
          )}
        </div>
        <PackageForm
          key={editingPackage?.id ?? "new"}
          customer={customer}
          services={services}
          editingPackage={editingPackage}
          onSaved={handleSaved}
        />
      </div>

      <ConfirmDialog
        show={!!deleteConfirm}
        onHide={() => {
          setDeleteConfirm(null);
          setDeleteError("");
        }}
        onConfirm={executeDelete}
        title="Elimina pacchetto"
        message={deleteError || `Vuoi eliminare il pacchetto "${deleteConfirm?.name ?? ""}"? Le sedute già effettuate rimarranno nello storico.`}
        confirmLabel="Elimina"
        confirmVariant="danger"
      />

      {rateEditorPkg && (
        <InstallmentEditor
          assignmentId={rateEditorPkg.id}
          packageName={rateEditorPkg.displayName || rateEditorPkg.customPackageName || rateEditorPkg.serviceTitle || "Pacchetto"}
          onClose={() => setRateEditorPkg(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
