import { useEffect, useMemo, useState } from "react";
import { Container, Row, Col, Card, Badge, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import ServiceModal from "./ServiceModal";
import DeleteServiceModal from "./DeleteServiceModal";
import { EditButton, DeleteButton } from "../../components/common/AdminActionButtons";
import AdminAddButton from "../../components/common/AdminAddButton";
import AdminToggle from "../../components/common/AdminToggle";
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

  const { user, accessToken } = useSelector(state => state.auth);
  const isAdmin = user?.role === "ADMIN";

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
      .filter(s => (cat === "all" ? true : s.categoryId === cat))
      .filter(s => s.title.toLowerCase().includes(q.toLowerCase()) || s.shortDescription.toLowerCase().includes(q.toLowerCase()));
  }, [allServices, cat, q]);

  // ---------- DELETE ----------
  const handleDeleteConfirm = async id => {
    try {
      await deleteService(id, accessToken);
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
    <Container fluid className="py-5 container-base flex-column">
      <div className="sp-page-head">
        <span className="section-eyebrow">Trattamenti</span>
        <h1 className="sp-page-title">Prenota il tuo trattamento</h1>
        <p className="section-subtitle">Scegli tra i nostri trattamenti professionali e prenota direttamente online.</p>
      </div>

      <div className="sp-filter-bar">
        <button className={`sp-chip ${cat === "all" ? "sp-chip--active" : ""}`} onClick={() => setCat("all")}>
          <span className="sp-chip-label">Tutti</span>
        </button>

        {categories.map(c => (
          <button
            key={c.categoryId}
            className={`sp-chip ${cat === c.categoryId ? "sp-chip--active" : ""}`}
            onClick={() => setCat(c.categoryId)}
          >
            <span className="sp-chip-label">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="sp-search-wrap">
        <svg className="sp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input className="sp-search-input" placeholder="Cerca..." value={q} onChange={e => setQ(e.target.value)} />
        {q && (
          <button className="sp-search-clear" onClick={() => setQ("")} aria-label="Cancella">
            ×
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="mb-4 d-flex align-items-center justify-content-center">
          <AdminAddButton onClick={handleCreate} label="Nuovo servizio" />
        </div>
      )}

      <Container fluid="xxl">
        <Row className="g-4 g-xl-5">
          {filtered.map(s => (
            <Col key={s.serviceId} xs={12} sm={6} lg={6} xl={4} className="d-flex">
              <Card className={`br-card beauty-service-card h-100${isAdmin && !(s.active ?? true) ? " admin-entity--inactive" : ""}`} onClick={() => navigate(`/trattamenti/${s.serviceId}`)}>
                {isAdmin && (
                  <div className="admin-card-toggle-corner" onClick={e => e.stopPropagation()}>
                    <AdminToggle
                      entityId={s.serviceId}
                      isActive={s.active ?? true}
                      endpoint="/service-items"
                      onToggleSuccess={newVal =>
                        setAllServices(prev => prev.map(svc => svc.serviceId === s.serviceId ? { ...svc, active: newVal } : svc))
                      }
                    />
                  </div>
                )}
                <div className="bsc-img-wrap">
                  <Card.Img src={s.images?.[0]} alt={s.title} />
                  <div className="bsc-img-overlay">
                    <span className="bsc-duration">{s.durationMin} min</span>
                  </div>
                </div>
                <Card.Body className="d-flex flex-column">
                  <div className="bsc-accent-line" />
                  <Card.Title className="bsc-title mb-1">{s.title}</Card.Title>
                  <div className="mb-2 d-flex align-items-center gap-2">
                    <Badge bg={badgeColors[s.categoryId] || "secondary"} className="text-uppercase">
                      {categoriesMap[s.categoryId] || "Senza categoria"}
                    </Badge>
                    <small className="text-muted">{s.durationMin} min</small>
                  </div>
                  <Card.Text className="flex-grow-1">{s.shortDescription}</Card.Text>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <span className="bsc-price">{s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                    {isAdmin && (
                      <div className="d-flex gap-2 ms-auto">
                        <EditButton onClick={() => handleEdit(s)} />
                        <DeleteButton onClick={() => { setSelectedService(s); setDeleteModal(true); }} />
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>

      {isAdmin && (
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
