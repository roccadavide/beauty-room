import { Button, Modal } from "react-bootstrap";

const DeletePromotionModal = ({ show, onHide, promotion, onConfirm }) => {
  if (!promotion) return null;
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Elimina promozione</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Sei sicuro di voler eliminare <strong>{promotion.title}</strong>? L'azione è irreversibile.
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annulla
        </Button>
        <Button variant="danger" onClick={() => onConfirm(promotion.promotionId)}>
          Elimina
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeletePromotionModal;
