// Migrated to ConfirmDialog — 2026-03-20 — see _unified-drawer.css
import ConfirmDialog from "../../components/common/ConfirmDialog";

const DeleteResultModal = ({ show, onHide, result, onConfirm }) => (
  <ConfirmDialog
    show={show && Boolean(result)}
    onHide={onHide}
    onConfirm={() => onConfirm(result?.resultId)}
    title="Elimina risultato"
    message={`Sei sicuro di voler eliminare "${result?.title}"? Questa azione non può essere annullata.`}
    confirmLabel="Elimina"
    confirmVariant="danger"
  />
);

export default DeleteResultModal;
