// Migrated to ConfirmDialog — 2026-03-20 — see _unified-drawer.css
import ConfirmDialog from "../../components/common/ConfirmDialog";

const DeleteServiceModal = ({ show, onHide, service, onConfirm }) => (
  <ConfirmDialog
    show={show && Boolean(service)}
    onHide={onHide}
    onConfirm={() => onConfirm(service?.serviceId)}
    title="Elimina servizio"
    message={`Sei sicuro di voler eliminare "${service?.title}"? Questa azione non può essere annullata.`}
    confirmLabel="Elimina"
    confirmVariant="danger"
  />
);

export default DeleteServiceModal;
