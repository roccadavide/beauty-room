// Migrated to ConfirmDialog — 2026-03-20 — see _unified-drawer.css
import ConfirmDialog from "../../components/common/ConfirmDialog";

const DeleteProductModal = ({ show, onHide, product, onConfirm }) => (
  <ConfirmDialog
    show={show && Boolean(product)}
    onHide={onHide}
    onConfirm={() => onConfirm(product?.productId)}
    title="Elimina prodotto"
    message={`Sei sicuro di voler eliminare "${product?.name ?? product?.title}"? Questa azione non può essere annullata.`}
    confirmLabel="Elimina"
    confirmVariant="danger"
  />
);

export default DeleteProductModal;
