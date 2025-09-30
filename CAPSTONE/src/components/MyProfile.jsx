import { useState } from "react";
import { Container, Row, Col, Card, Badge, Button, ListGroup } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import EditProfileModal from "./EditProfileModal";
import { UPDATE_USER } from "../redux/action/authActions";
import ChangePasswordModal from "./ChangePasswordModal";

const MyProfile = () => {
  const { user } = useSelector(state => state.auth);
  const [openModal, setOpenModal] = useState(false);
  const [openPasswordModal, setOpenPasswordModal] = useState(false);
  const dispatch = useDispatch();

  const name = user?.name || "Utente";
  const surname = user?.surname || "";
  const email = user?.email || "-";
  const phone = user?.phone || "-";
  const role = user?.role || "USER";
  const id = user?.id || "-";

  const handleProfileUpdated = updatedUser => {
    dispatch({ type: UPDATE_USER, payload: updatedUser });
    setOpenModal(false);
  };

  const initials = `${(name?.[0] || "").toUpperCase()}${(surname?.[0] || "").toUpperCase()}`;

  const roleVariant = role === "ADMIN" ? "danger" : role === "CUSTOMER" ? "warning" : "secondary";

  const copy = text => navigator.clipboard?.writeText(text);

  return (
    <Container className="profile-container">
      <Row className="justify-content-center">
        <Col xs={12} lg={10} xl={8}>
          <Card className="profile-card shadow-lg">
            <div className="profile-hero">
              <div className="avatar">
                <span>{initials || "U"}</span>
              </div>
              <div>
                <h2 className="mb-1 text-white">
                  {name} {surname}
                </h2>
                <Badge bg={roleVariant} className="role-badge">
                  {role}
                </Badge>
              </div>
            </div>

            <Card.Body className="p-4">
              <Row className="g-4">
                <Col md={6}>
                  <ListGroup className="profile-list">
                    <ListGroup.Item className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="label">Email</div>
                        <div className="value">{email}</div>
                      </div>
                      <div className="d-flex gap-2">
                        <a className="btn btn-outline-primary btn-sm" href={`mailto:${email}`}>
                          Scrivi
                        </a>
                        <Button size="sm" variant="outline-secondary" onClick={() => copy(email)}>
                          Copia
                        </Button>
                      </div>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="label">Telefono</div>
                        <div className="value">{phone}</div>
                      </div>
                      <div className="d-flex gap-2">
                        <a className="btn btn-outline-primary btn-sm" href={`tel:${phone}`}>
                          Chiama
                        </a>
                        <Button size="sm" variant="outline-secondary" onClick={() => copy(phone)}>
                          Copia
                        </Button>
                      </div>
                    </ListGroup.Item>
                  </ListGroup>
                </Col>

                <Col md={6}>
                  <ListGroup className="profile-list">
                    <ListGroup.Item className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="label">ID Utente</div>
                        <div className="value monospace">{id}</div>
                      </div>
                      <Button size="sm" variant="outline-secondary" onClick={() => copy(id)}>
                        Copia
                      </Button>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="label">Ruolo</div>
                        <div className="value">
                          <Badge bg={roleVariant}>{role}</Badge>
                        </div>
                      </div>
                    </ListGroup.Item>
                  </ListGroup>
                </Col>
              </Row>

              <div className="mt-4 d-flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setOpenModal(true)}>
                  Modifica profilo
                </Button>
                <Button variant="outline-danger d-flex" onClick={() => setOpenPasswordModal(true)}>
                  Cambia password
                </Button>
                <a href={`mailto:${email}?subject=Richiesta%20informazioni%20dal%20sito`} className="btn btn-outline-dark">
                  Contatta supporto
                </a>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <EditProfileModal show={openModal} onHide={() => setOpenModal(false)} user={user} onProfileUpdated={handleProfileUpdated} />
      <ChangePasswordModal show={openPasswordModal} onHide={() => setOpenPasswordModal(false)} userId={user.id} />
    </Container>
  );
};

export default MyProfile;
