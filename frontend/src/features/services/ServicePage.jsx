import { useEffect, useMemo, useState } from "react";
import { Container, Row, Col, Form, Button, Card, Badge, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import ServiceModal from "./ServiceModal";
import DeleteServiceModal from "./DeleteServiceModal";
import { PencilFill, Trash2Fill, Plus } from "react-bootstrap-icons";
import { fetchCategories } from "../../api/modules/categories.api";
import { deleteService, fetchServices } from "../../api/modules/services.api";

const ServicePage = () => {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [allServices, setAllServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [editingService, setEditingService] = useState(null);

  const { user, token } = useSelector(state => state.auth);

  const navigate = useNavigate();

  // ---------- FETCH ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const [services, cats] = await Promise.all([fetchServices(), fetchCategories()]);
        setAllServices(services);
        setCategories(cats);
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

  // ---------- FILTER ----------
  const filtered = useMemo(() => {
    return allServices
      .filter(s => (cat === "all" ? true : s.categoryName === cat))
      .filter(s => s.title.toLowerCase().includes(q.toLowerCase()) || s.shortDescription.toLowerCase().includes(q.toLowerCase()));
  }, [allServices, cat, q]);

  // ---------- DELETE ----------
  const handleDeleteConfirm = async id => {
    try {
      await deleteService(id, token);
      setAllServices(prev => prev.filter(s => s.serviceId !== id));
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
      setAllServices(prev => prev.map(s => (s.serviceId === updatedService.serviceId ? updatedService : s)));
    } else {
      setAllServices(prev => [...prev, updatedService]);
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
        <p>{error}</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-5" style={{ marginTop: "7rem" }}>
      <h1 className="text-center mb-3">Prenota un trattamento</h1>

      <div className="d-flex flex-wrap justify-content-center gap-2 mb-4">
        <Button key="all" variant={cat === "all" ? "dark" : "outline-dark"} onClick={() => setCat("all")} className="rounded-pill px-3">
          Tutti
        </Button>

        {categories.map(c => (
          <Button
            key={c.categoryId}
            variant={cat === c.categoryId ? "dark" : "outline-dark"}
            onClick={() => setCat(c.categoryId)}
            className="rounded-pill px-3"
          >
            {c.label}
          </Button>
        ))}
      </div>

      <Container className="mb-4">
        <Form.Control placeholder="Cerca un servizio..." value={q} onChange={e => setQ(e.target.value)} />
      </Container>

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

      <Container>
        <Row className="g-4 justify-content-center">
          {filtered.map(s => (
            <Col key={s.serviceId} xs={12} sm={6} md={4} lg={3} className="d-flex justify-content-center">
              <Card className="h-100 shadow-sm" onClick={() => navigate(`/trattamenti/${s.serviceId}`)}>
                <div className="card-img-container">
                  <Card.Img src={s.images?.[0]} alt={s.title} />
                </div>
                <Card.Body className="d-flex flex-column">
                  <Card.Title className="mb-1">{s.title}</Card.Title>
                  <div className="mb-2 d-flex align-items-center gap-2">
                    <Badge bg={badgeColors[s.categoryName] || "secondary"} className="text-uppercase">
                      {categoriesMap[s.categoryName] || "Senza categoria"}
                    </Badge>
                    <small className="text-muted">{s.durationMin} min</small>
                  </div>
                  <Card.Text className="flex-grow-1">{s.shortDescription}</Card.Text>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <strong>{s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</strong>
                    {user?.role === "ADMIN" && (
                      <div className="d-flex gap-2 ms-auto">
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
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>

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

export default ServicePage;
