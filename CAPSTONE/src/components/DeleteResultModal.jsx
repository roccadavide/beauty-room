import { Modal, Button } from "react-bootstrap";

const DeleteResultModal = ({ show, onHide, result, onConfirm }) => {
  if (!result) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Conferma eliminazione</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Sei sicuro di voler eliminare il risultato <strong>{result.title}</strong>? Questa azione non può essere annullata.
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annulla
        </Button>
        <Button variant="danger" onClick={() => onConfirm(result.resultId)}>
          Elimina
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteResultModal;
