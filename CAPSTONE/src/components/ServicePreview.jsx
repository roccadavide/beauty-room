import { useEffect, useState, useMemo } from "react";
import { Container, Row, Col, Card, Badge, Button, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { fetchCategories, fetchServices, deleteService } from "../api/api";
import { useNavigate } from "react-router-dom";
import { Plus, PencilFill, Trash2Fill } from "react-bootstrap-icons";
import ServiceModal from "./ServiceModal";
import DeleteServiceModal from "./DeleteServiceModal";

const ServicesPreview = () => {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [editingService, setEditingService] = useState(null);

  const { user, token } = useSelector(state => state.auth);
  const navigate = useNavigate();

  const FEATURED_IDS = [
    "fd901469-1602-4707-b507-453f87b0ff29", //Latin brows (Mix pelo + sfumatura)
    "a94db4fb-2997-4167-8121-e8d906099e21", //Laminazione ciglia
    "785c6c1a-f392-4fca-92d2-9bf33752353a", //Translucent Lips, effetto sfumato
  ];

  // ---------- FETCH ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allServices, cats] = await Promise.all([fetchServices(), fetchCategories()]);
        setCategories(cats);
        console.log(cats);
        const featured = allServices.filter(s => FEATURED_IDS.includes(s.serviceId));
        setServices(featured);
        console.log(featured);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ---------- CATEGORIES MAP ----------
  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      map[c.categoryId] = c.label;
    });
    return map;
  }, [categories]);

  // ---------- DELETE ----------
  const handleDeleteConfirm = async id => {
    try {
      await deleteService(id, token);
      setServices(prev => prev.filter(s => s.serviceId !== id));
      setDeleteModal(false);
      setSelectedService(null);
    } catch (err) {
      alert("Errore durante l'eliminazione: " + err.message);
    }
  };

  // ---------- EDIT ----------
  const handleEdit = service => {
    setEditingService(service);
    setOpen(true);
  };

  // ---------- CREATE ----------
  const handleCreate = () => {
    setEditingService(null);
    setOpen(true);
  };

  // ---------- UPDATE OR CREATE ----------
  const handleServiceSaved = updatedService => {
    if (editingService) {
      setServices(prev => prev.map(s => (s.serviceId === updatedService.serviceId ? updatedService : s)));
    } else {
      setServices(prev => [...prev, updatedService]);
    }
    setOpen(false);
    setEditingService(null);
  };

  const badgeColors = {
    "036f8d73-0d71-415f-b4cb-db4711c4c586": "primary", // Trucco permanente
    "1225ed9f-c5c8-4003-97b0-50a62874de4a": "success", // Piedi
    "89bbe501-6470-46a6-9187-1e19f9241bf4": "warning", // Mani
    "a8a1465f-032b-4481-8f47-160504b6036b": "info", // Corpo
    "f39e37ff-1210-4446-8968-610d2d1d6563": "danger", // Viso
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <Container className="container-base">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="container-base">
        <p className="text-danger">{error}</p>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <h2 className="text-center mb-4">Trattamenti in evidenza</h2>

      {user?.role === "ADMIN" && (
        <div className="mb-4 d-flex align-items-center justify-content-center">
          <Button
            variant="success"
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: "3rem", height: "3rem" }}
            onClick={handleCreate}
          >
            <Plus />
          </Button>
        </div>
      )}

      <Row className="g-4 justify-content-evenly">
        {services.map(s => (
          <Col key={s.serviceId} xs={12} sm={6} md={4} lg={3} className="d-flex justify-content-center">
            <Card className="h-100 shadow-sm" onClick={() => navigate(`/trattamenti/${s.serviceId}`)}>
              <Card.Img src={s.images?.[0]} alt={s.title} />
              <Card.Body className="d-flex flex-column">
                <Card.Title>{s.title}</Card.Title>
                <div className="mb-2 d-flex align-items-center gap-2">
                  <Badge bg={badgeColors[s.categoryName] || "secondary"} className="text-uppercase">
                    {categoriesMap[s.categoryName] || "Senza categoria"}
                  </Badge>
                  <small className="text-muted">{s.durationMin} min</small>
                </div>
                <Card.Text className="flex-grow-1">{s.shortDescription}</Card.Text>
                <strong>{s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</strong>

                {user?.role === "ADMIN" && (
                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      className="rounded-circle d-flex justify-content-center align-items-center"
                      onClick={e => {
                        e.stopPropagation();
                        handleEdit(s);
                      }}
                    >
                      <PencilFill />
                    </Button>
                    <Button
                      variant="danger"
                      className="rounded-circle d-flex justify-content-center align-items-center"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedService(s);
                        setDeleteModal(true);
                      }}
                    >
                      <Trash2Fill />
                    </Button>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {user?.role === "ADMIN" && (
        <>
          <ServiceModal
            show={open}
            onHide={() => {
              setOpen(false);
              setEditingService(null);
            }}
            categories={categories}
            service={editingService}
            onServiceSaved={handleServiceSaved}
          />
          <DeleteServiceModal show={deleteModal} onHide={() => setDeleteModal(false)} service={selectedService} onConfirm={handleDeleteConfirm} />
        </>
      )}
    </Container>
  );
};

export default ServicesPreview;
