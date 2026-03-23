// Migrated to UnifiedDrawer — 2026-03-20 — see _unified-drawer.css
import { useEffect, useState } from "react";
import { Col, Form, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { createPackage, updatePackage, deletePackage } from "../../api/modules/packages.api";
import UnifiedDrawer from "../../components/common/UnifiedDrawer";

const PackageDrawer = ({ show, onHide, onSaved, onDeleted, services, pkg }) => {
  const { accessToken } = useSelector(s => s.auth);
  const isEdit = Boolean(pkg);

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState(2);
  const [price, setPrice] = useState("");
  const [group, setGroup] = useState("");
  const [gender, setGender] = useState("");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");

  useEffect(() => {
    if (show) {
      if (isEdit) {
        setSelectedServiceId(pkg.serviceId ?? "");
        setName(pkg.optionName ?? pkg.name ?? "");
        setSessions(pkg.sessions ?? 2);
        setPrice(pkg.price != null ? String(pkg.price) : "");
        setGroup(pkg.optionGroup ?? "");
        setGender(pkg.gender ?? "");
        setActive(pkg.active ?? true);
      } else {
        setSelectedServiceId(services[0]?.serviceId ?? "");
        setName("");
        setSessions(2);
        setPrice("");
        setGroup("");
        setGender("");
        setActive(true);
      }
      setErrors({});
      setErrorMsg("");
      setConfirmDelete(false);
      setServiceSearch("");
    }
  }, [show, isEdit, pkg, services]);

  const validate = () => {
    const errs = {};
    if (!isEdit && !selectedServiceId) errs.selectedServiceId = "Seleziona un trattamento.";
    if (!name.trim()) errs.name = "Il nome è obbligatorio.";
    if (!sessions || Number(sessions) < 2) errs.sessions = "Minimo 2 sedute.";
    if (!price || Number(price) <= 0) errs.price = "Il prezzo deve essere maggiore di zero.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrorMsg("");
    const dto = {
      name: name.trim(),
      price: parseFloat(price),
      sessions: parseInt(sessions, 10),
      optionGroup: group.trim() || null,
      gender: gender || null,
      active,
    };
    try {
      if (isEdit) {
        const saved = await updatePackage(pkg.optionId, dto, accessToken);
        onSaved({ ...pkg, ...saved });
      } else {
        const saved = await createPackage(selectedServiceId, dto, accessToken);
        const svc = services.find(s => s.serviceId === selectedServiceId);
        onSaved({ ...saved, serviceName: svc?.title ?? "" });
      }
      onHide();
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err.message || "Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      await deletePackage(pkg.optionId, accessToken);
      onDeleted(pkg.optionId);
      onHide();
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err.message || "Errore durante l'eliminazione.");
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter(s => s.title.toLowerCase().includes(serviceSearch.toLowerCase()));

  return (
    <UnifiedDrawer
      show={show}
      onHide={onHide}
      title={isEdit ? "Modifica Pacchetto" : "Nuovo Pacchetto"}
      size="sm"
      footer={
        <>
          {errorMsg && <p className="ud-error">{errorMsg}</p>}
          <div className="ud-footer-actions" style={{ justifyContent: isEdit ? "space-between" : "flex-end" }}>
            {isEdit && (
              <button type="button" className="bm-btn bm-btn--danger" onClick={handleDelete} disabled={loading}>
                {confirmDelete ? "Conferma eliminazione" : "Elimina pacchetto"}
              </button>
            )}
            <div className="d-flex gap-2">
              <button type="button" className="bm-btn bm-btn--ghost" onClick={onHide} disabled={loading}>
                Annulla
              </button>
              <button type="button" className="bm-btn bm-btn--primary" onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" /> Salvataggio…
                  </>
                ) : isEdit ? (
                  "Salva modifiche"
                ) : (
                  "Crea"
                )}
              </button>
            </div>
          </div>
        </>
      }
    >
      <Form>
        <Row className="g-3">
          {isEdit ? (
            <Col md={12}>
              <Form.Group>
                <Form.Label>Trattamento di riferimento</Form.Label>
                <p className="mb-0 fw-semibold">{pkg.serviceName ?? ""}</p>
              </Form.Group>
            </Col>
          ) : (
            <Col md={12}>
              <Form.Group>
                <Form.Label>Trattamento di riferimento *</Form.Label>
                <div className="pkg-service-search-wrap">
                  <input
                    type="text"
                    className="sps-search pkg-service-search"
                    placeholder="Cerca trattamento..."
                    value={serviceSearch}
                    onChange={e => setServiceSearch(e.target.value)}
                  />
                </div>
                <div className="pkg-service-list">
                  {filteredServices.length === 0 && <p className="sps-empty">Nessun trattamento trovato</p>}
                  {filteredServices.map(s => (
                    <label key={s.serviceId} className={`sps-item${selectedServiceId === s.serviceId ? " sps-item--checked" : ""}`}>
                      <input
                        type="radio"
                        name="pkg-service"
                        className="sps-checkbox"
                        checked={selectedServiceId === s.serviceId}
                        onChange={() => setSelectedServiceId(s.serviceId)}
                      />
                      <span className="sps-item-name">{s.title}</span>
                      {s.price && <span className="sps-item-price">{Number(s.price).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>}
                    </label>
                  ))}
                </div>
                {errors.selectedServiceId && <div className="invalid-feedback d-block">{errors.selectedServiceId}</div>}
              </Form.Group>
            </Col>
          )}

          <Col md={12}>
            <Form.Group>
              <Form.Label>Nome del pacchetto *</Form.Label>
              <Form.Control placeholder="Es. Pacchetto 5 sedute gambe" value={name} onChange={e => setName(e.target.value)} isInvalid={!!errors.name} />
              <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group>
              <Form.Label>Numero di sedute *</Form.Label>
              <Form.Control type="number" min={2} value={sessions} onChange={e => setSessions(e.target.value)} isInvalid={!!errors.sessions} />
              <Form.Text className="text-muted">Minimo 2 per essere considerato un pacchetto</Form.Text>
              <Form.Control.Feedback type="invalid">{errors.sessions}</Form.Control.Feedback>
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group>
              <Form.Label>Prezzo del pacchetto *</Form.Label>
              <Form.Control type="number" step="0.01" min={0} value={price} onChange={e => setPrice(e.target.value)} isInvalid={!!errors.price} />
              <Form.Control.Feedback type="invalid">{errors.price}</Form.Control.Feedback>
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group>
              <Form.Label>Zona / Gruppo</Form.Label>
              <Form.Control placeholder="Es. Gambe, Viso, Corpo" value={group} onChange={e => setGroup(e.target.value)} />
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group>
              <Form.Label>Per chi è indicato</Form.Label>
              <Form.Select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Nessuna preferenza</option>
                <option value="Donna">Donna</option>
                <option value="Uomo">Uomo</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={12}>
            <Form.Check type="switch" id="pkg-active" label="Pacchetto visibile" checked={active} onChange={e => setActive(e.target.checked)} />
          </Col>
        </Row>
      </Form>
    </UnifiedDrawer>
  );
};

export default PackageDrawer;
