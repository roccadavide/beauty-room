import { Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";

const BookingSuccessPage = () => {
  return (
    <Container className="py-5 text-center container-base flex-column">
      <h2 className="mb-4">🎉 Prenotazione completata con successo!</h2>
      <p>Ti abbiamo inviato un’email con tutti i dettagli.</p>
      <Link to="/trattamenti">
        <Button variant="dark" className="mt-3">
          Torna ai trattamenti
        </Button>
      </Link>
    </Container>
  );
};

export default BookingSuccessPage;
