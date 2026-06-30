import CustomerAutocomplete from "../../../components/admin/CustomerAutocomplete";

export default function ClientSearch({ value, onChange, onSelect, hasSelection }) {
  return (
    <div className="cli-search-card">
      <div className="cli-search-label">Cerca cliente</div>
      <CustomerAutocomplete
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        placeholder="Cerca per nome, telefono o email…"
      />
      {!hasSelection && (
        <div className="cli-search-empty">
          Cerca una cliente per nome, telefono o email.
        </div>
      )}
    </div>
  );
}
