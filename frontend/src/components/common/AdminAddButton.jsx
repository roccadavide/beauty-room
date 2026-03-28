import { Plus } from "react-bootstrap-icons";
import "./AdminAddButton.css";

/**
 * Bottone admin "Nuovo / Aggiungi" — design system Editorial Beauty.
 *
 * Props:
 *   onClick   () => void
 *   label     string          – es. "Nuovo servizio"
 *   icon      ReactNode       – icona custom (default <Plus size={16} />)
 *   disabled  bool
 *   className string          – classi aggiuntive per il contenitore
 */
export default function AdminAddButton({ onClick, label, icon, disabled = false, className = "" }) {
  return (
    <button
      type="button"
      className={`admin-add-btn${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ?? <Plus size={16} />}
      {label}
    </button>
  );
}
