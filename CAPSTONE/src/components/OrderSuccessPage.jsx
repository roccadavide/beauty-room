import { Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";

const OrderSuccessPage = () => {
  return (
    <Container className="py-5 text-center" style={{ marginTop: "7rem" }}>
      <h2 className="mb-4">🎉 Ordine completato con successo!</h2>
      <p>Ti abbiamo inviato un’email con i dettagli dell’ordine.</p>
      <Link to="/prodotti">
        <Button variant="dark" className="mt-3">
          Torna ai prodotti
        </Button>
      </Link>
    </Container>
  );
};

export default OrderSuccessPage;
