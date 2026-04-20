import { useEffect, useMemo, useState, useRef } from "react";
import { Container, Row } from "react-bootstrap";
import ServicePageSkeleton from "./ServicePageSkeleton";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import ServiceModal from "./ServiceModal";
import DeleteServiceModal from "./DeleteServiceModal";
import AdminAddButton from "../../components/common/AdminAddButton";
import { fetchCategories } from "../../api/modules/categories.api";
import { deleteService, fetchServices } from "../../api/modules/services.api";
import SEO from "../../components/common/SEO";
import useScrollRestore from "../../hooks/useScrollRestore";
import ServiceCard from "./ServiceCard";

const ServicePage = () => {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [allServices, setAllServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { save } = useScrollRestore("service-page");
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [editingService, setEditingService] = useState(null);

  const { user, accessToken } = useSelector(state => state.auth);
  const isAdmin = user?.role === "ADMIN";

  const navigate = useNavigate();
  const rowRef = useRef(null);

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

  // Stampa data-scroll-id sui figli del Row dopo il render
  useEffect(() => {
    if (!rowRef.current || loading) return;
    const children = rowRef.current.children;
    filtered.forEach((s, i) => {
      if (children[i]) {
        children[i].setAttribute("data-scroll-id", s.serviceId);
      }
    });
  }, [filtered, loading]);

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

  // ---------- UI ----------
  if (loading) return <ServicePageSkeleton />;

  if (error) {
    return (
      <Container className="container-base">
        <p>{error}</p>
      </Container>
    );
  }

  return (
    <Container fluid className="pb-5 container-base flex-column">
      <SEO
        title="Servizi"
        description="Scopri tutti i trattamenti estetici di Beauty Room: laser, viso, corpo, estetica avanzata. Prenota il tuo appuntamento online."
      />
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
          <button key={c.categoryId} className={`sp-chip ${cat === c.categoryId ? "sp-chip--active" : ""}`} onClick={() => setCat(c.categoryId)}>
            <span className="sp-chip-label">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="sp-search-wrap">
        <svg className="sp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input className="sp-search-input" placeholder="Cerca trattamento..." value={q} onChange={e => setQ(e.target.value)} />
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
        <Row ref={rowRef} className="g-4 g-xl-5">
          {filtered.map(s => (
            <ServiceCard
              key={s.serviceId}
              s={s}
              isAdmin={isAdmin}
              categoriesMap={categoriesMap}
              onCardClick={() => {
                save(s.serviceId);
                navigate(`/trattamenti/${s.serviceId}`);
              }}
              onEdit={() => handleEdit(s)}
              onDelete={() => {
                setSelectedService(s);
                setDeleteModal(true);
              }}
              onToggleActive={newVal => setAllServices(prev => prev.map(svc => (svc.serviceId === s.serviceId ? { ...svc, active: newVal } : svc)))}
            />
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
