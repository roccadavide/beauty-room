import { useState } from "react";
import { Button, Form, Modal, Tab, Tabs } from "react-bootstrap";
import { updateStaff } from "../../../api/modules/team.api";
import StaffServicesEditor from "./StaffServicesEditor";
import StaffHoursEditor from "./StaffHoursEditor";
import StaffAbsences from "./StaffAbsences";

/*
 * Manage one staff member: basic info (rename/recolor/reorder), service
 * assignments, per-staff hours, absences. react-bootstrap Modal portals to body.
 */
export default function StaffManageModal({ staff, onHide, onUpdated }) {
  const [tab, setTab] = useState("info");

  const [displayName, setDisplayName] = useState(staff.displayName || "");
  const [color, setColor] = useState(staff.color || "#c9a24b");
  const [sortOrder, setSortOrder] = useState(staff.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSaveInfo = async () => {
    if (displayName.trim().length < 2) { setError("Nome troppo corto (min 2)."); return; }
    setError("");
    setSaving(true);
    try {
      const updated = await updateStaff(staff.id, {
        displayName: displayName.trim(),
        color: color || null,
        sortOrder: Number(sortOrder) || 0,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onUpdated(updated);
    } catch (e) {
      setError(e.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show onHide={onHide} centered size="lg" backdrop="static" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="team-dot" style={{ background: staff.color || "#c9a24b" }} />
          {staff.displayName}
          {!staff.active && <span className="team-inactive-tag">inattivo</span>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs activeKey={tab} onSelect={k => setTab(k || "info")} className="team-tabs mb-3">
          <Tab eventKey="info" title="Info">
            <Form className="d-grid gap-3">
              <Form.Group>
                <Form.Label>Nome visualizzato</Form.Label>
                <Form.Control value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={80} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Colore agenda</Form.Label>
                <div className="team-color-row">
                  <Form.Control
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="team-color-input"
                  />
                  <span className="team-color-value">{color}</span>
                </div>
              </Form.Group>
              <Form.Group>
                <Form.Label>Ordinamento</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                  style={{ width: 120 }}
                />
                <Form.Text muted>Determina l'ordine nelle colonne agenda e nel booking pubblico.</Form.Text>
              </Form.Group>

              {error && <div className="imp-field-error">{error}</div>}

              <div className="imp-save-row">
                <button type="button" className="imp-save-btn" onClick={handleSaveInfo} disabled={saving}>
                  {saving ? "Salvataggio…" : "Salva info"}
                </button>
                {success && <span className="imp-save-ok">✓ Salvato</span>}
              </div>
            </Form>
          </Tab>

          <Tab eventKey="servizi" title="Servizi">
            {tab === "servizi" && <StaffServicesEditor staffId={staff.id} />}
          </Tab>

          <Tab eventKey="orari" title="Orari">
            {tab === "orari" && <StaffHoursEditor staffId={staff.id} />}
          </Tab>

          <Tab eventKey="assenze" title="Assenze">
            {tab === "assenze" && <StaffAbsences staffId={staff.id} />}
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Chiudi
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
