import { Modal, Button } from "react-bootstrap";

const DeleteOrderModal = ({ show, onHide, order, onConfirm, isAdmin = false }) => {
  if (!order) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{isAdmin ? "Elimina ordine" : "Conferma eliminazione"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isAdmin ? (
          <p className="mb-0">
            Stai per eliminare definitivamente l&apos;ordine <strong>{order.orderId}</strong>.
            <br />
            Questa azione non può essere annullata.
          </p>
        ) : (
          <>
            <p className="mb-2">
              Sei sicuro di voler eliminare l&apos;ordine <strong>{order.orderId}</strong>? Questa azione non puo essere annullata.
            </p>
            <p className="mb-0">
              <strong>Stai per eliminare un ordine in attesa di pagamento.</strong>
              <br />
              Se hai gia pagato, contatta Michela direttamente.
            </p>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annulla
        </Button>
        <Button variant="danger" onClick={() => onConfirm(order.orderId)}>
          Elimina
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteOrderModal;
