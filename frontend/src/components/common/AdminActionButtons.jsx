export function EditButton({ onClick, title = "Modifica", disabled = false }) {
  return (
    <button
      className="br-action-btn br-action-btn--edit"
      title={title}
      disabled={disabled}
      onClick={e => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {/* PencilLine — Lucide style */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    </button>
  );
}

export function DeleteButton({ onClick, title = "Elimina", disabled = false }) {
  return (
    <button
      className="br-action-btn br-action-btn--delete"
      title={title}
      disabled={disabled}
      onClick={e => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {/* Trash2 — Lucide style */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  );
}
