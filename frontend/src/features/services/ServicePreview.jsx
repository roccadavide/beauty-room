import { useEffect, useState, useMemo } from "react";
import { Container, Row, Col, Card, Badge, Button, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Plus, PencilFill, Trash2Fill } from "react-bootstrap-icons";
import ServiceModal from "./ServiceModal";
import DeleteServiceModal from "./DeleteServiceModal";
import { fetchCategories } from "../../api/modules/categories.api";
import { deleteService, fetchServices } from "../../api/modules/services.api";

const FEATURED_SERVICE_IDS = [
  "268a5ef7-82ec-470f-ae6c-0598147f5dce", // Pelo Pelo
  "9c31f234-1699-476f-bcf5-2926faf56fa9", // Laminazione ciglia
  "785c6c1a-f392-4fca-92d2-9bf33752353a", // Translucent Lips, effetto sfumato
];

const ServicesPreview = () => {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [editingService, setEditingService] = useState(null);

  const { user, accessToken } = useSelector(state => state.auth);
  const navigate = useNavigate();

  // ---------- FETCH ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allServices, cats] = await Promise.all([fetchServices(), fetchCategories()]);
        setCategories(cats);
        const featured = allServices.filter(s => FEATURED_SERVICE_IDS.includes(s.serviceId));
        setServices(featured);
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
      await deleteService(id, accessToken);
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
    "2ab17c92-da9c-4b18-a04a-549eaa643ad3": "primary", //Trucco permanente
    "b5915bb8-869c-46b3-a2cc-82114e8fdeb1": "success", //Piedi
    "95b6d339-a765-4569-9aee-08107d27516b": "warning", //Mani
    "7f1255a7-7c26-4bf6-972b-d285b5bc6c36": "info", //Corpo
    "ddd9e4af-8343-42ce-8f93-1b48e2d4537c": "danger", //Viso
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
    <section className="services-preview">
      <Container>
        <div className="services-preview__head">
          <div className="services-preview__titles">
            <h2 className="services-preview__title">Ti consigliamo anche</h2>
            <p className="services-preview__subtitle">Selezione di trattamenti scelti da Michela per risultati visibili e look curato.</p>
          </div>

          <div className="services-preview__actions">
            <button type="button" className="services-preview__link" onClick={() => navigate("/trattamenti")}>
              Tutti i trattamenti →
            </button>

            {user?.role === "ADMIN" && (
              <Button variant="light" className="services-preview__add" onClick={handleCreate} title="Aggiungi trattamento">
                <Plus />
              </Button>
            )}
          </div>
        </div>

        <Row className="g-4 justify-content-evenly">
          {services.map(s => (
            <Col key={s.serviceId} xs={12} sm={6} md={4} lg={3} className="d-flex justify-content-center">
              <Card
                className="br-card br-card--service h-100"
                onClick={() => navigate(`/trattamenti/${s.serviceId}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && navigate(`/trattamenti/${s.serviceId}`)}
              >
                <div className="card-img-container">
                  <Card.Img src={s.images?.[0]} alt={s.title} />
                </div>

                <Card.Body className="d-flex flex-column">
                  <Card.Title>{s.title}</Card.Title>

                  <div className="mb-2 d-flex align-items-center gap-2">
                    <Badge bg={badgeColors[s.categoryId] || "secondary"} className="text-uppercase">
                      {categoriesMap[s.categoryId] || "Senza categoria"}
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
    </section>
  );
};

export default ServicesPreview;
