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
      <section className="sp-section">
        <Container className="container-base">
          <Spinner animation="border" role="status" />
        </Container>
      </section>
    );
  }

  if (error) {
    return (
      <section className="sp-section">
        <Container className="container-base">
          <p className="text-danger">{error}</p>
        </Container>
      </section>
    );
  }

  return (
    <section className="sp-section">
      <Container>
        {/* Header centrato */}
        <div className="sp-head">
          <span className="sp-eyebrow">I nostri trattamenti</span>
          {/* FIX-20: sp-title/sp-subtitle → section-title/section-subtitle (identici, unificati) */}
          <h2 className="section-title">Scelti per te da Michela</h2>
          <p className="section-subtitle">
            Una selezione dei trattamenti più amati, per un look curato
            e risultati visibili fin dalla prima seduta.
          </p>
        </div>

        {/* Carousel wrapper */}
        <div className="sp-track-wrapper">
          <div className="sp-track" id="spTrack">
            {services.map(s => (
              <div key={s.serviceId} className="sp-slide">
                <div
                  className="sp-card"
                  onClick={() => navigate(`/trattamenti/${s.serviceId}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && navigate(`/trattamenti/${s.serviceId}`)}
                >
                  <div className="sp-card__img-wrap">
                    {s.images?.[0] ? (
                      <img src={s.images[0]} alt={s.title} />
                    ) : (
                      <div className="sp-card__img-placeholder" />
                    )}
                    <div className="sp-card__overlay">
                      <span className="sp-card__duration">{s.durationMin} min</span>
                      <h3 className="sp-card__title">{s.title}</h3>
                      <p className="sp-card__desc">{s.shortDescription}</p>
                      <span className="sp-card__price">
                        {s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                      </span>
                    </div>
                  </div>

                  {user?.role === "ADMIN" && (
                    <div className="sp-card__admin" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-circle"
                        onClick={() => handleEdit(s)}
                      >
                        <PencilFill />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="rounded-circle"
                        onClick={() => {
                          setSelectedService(s);
                          setDeleteModal(true);
                        }}
                      >
                        <Trash2Fill />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            className="sp-arrow sp-arrow--prev"
            aria-label="Precedente"
            onClick={() => {
              document.getElementById("spTrack")?.scrollBy({ left: -320, behavior: "smooth" });
            }}
          >
            ‹
          </button>
          <button
            className="sp-arrow sp-arrow--next"
            aria-label="Successivo"
            onClick={() => {
              document.getElementById("spTrack")?.scrollBy({ left: 320, behavior: "smooth" });
            }}
          >
            ›
          </button>
        </div>

        <div className="sp-footer">
          <button
            type="button"
            className="sp-cta-btn"
            onClick={() => navigate("/trattamenti")}
          >
            Scopri tutti i trattamenti →
          </button>

          {user?.role === "ADMIN" && (
            <Button variant="light" className="sp-admin-add" onClick={handleCreate}>
              <Plus /> Aggiungi
            </Button>
          )}
        </div>

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
            <DeleteServiceModal
              show={deleteModal}
              onHide={() => setDeleteModal(false)}
              service={selectedService}
              onConfirm={handleDeleteConfirm}
            />
          </>
        )}
      </Container>
    </section>
  );
};

export default ServicesPreview;
