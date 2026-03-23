import { useState, useMemo } from "react";

export default function ServiceProductSelector({ scope, services, products, selectedServiceIds, selectedProductIds, onServicesChange, onProductsChange }) {
  const [tab, setTab] = useState(scope === "PRODUCTS" ? "products" : "services");
  const [search, setSearch] = useState("");

  const showServices = scope === "SERVICES" || scope === "MIXED";
  const showProducts = scope === "PRODUCTS" || scope === "MIXED";

  const filteredServices = useMemo(() => services.filter(s => s.title?.toLowerCase().includes(search.toLowerCase())), [services, search]);

  const filteredProducts = useMemo(() => products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())), [products, search]);

  const toggleService = id => {
    const sid = String(id);
    const next = selectedServiceIds.includes(sid) ? selectedServiceIds.filter(x => x !== sid) : [...selectedServiceIds, sid];
    onServicesChange(next);
  };

  const toggleProduct = id => {
    const pid = String(id);
    const next = selectedProductIds.includes(pid) ? selectedProductIds.filter(x => x !== pid) : [...selectedProductIds, pid];
    onProductsChange(next);
  };

  const totalSelected = selectedServiceIds.length + selectedProductIds.length;

  return (
    <div className="sps-wrap">
      <p className="sps-label">A chi si applica questa promozione</p>

      {scope === "MIXED" && (
        <div className="sps-tab-bar">
          <button
            type="button"
            className={`sps-tab ${tab === "services" ? "sps-tab--active" : ""}`}
            onClick={() => {
              setTab("services");
              setSearch("");
            }}
          >
            Trattamenti{selectedServiceIds.length > 0 && <span className="sps-count">{selectedServiceIds.length}</span>}
          </button>
          <button
            type="button"
            className={`sps-tab ${tab === "products" ? "sps-tab--active" : ""}`}
            onClick={() => {
              setTab("products");
              setSearch("");
            }}
          >
            Prodotti{selectedProductIds.length > 0 && <span className="sps-count">{selectedProductIds.length}</span>}
          </button>
        </div>
      )}

      <div className="sps-search-wrap">
        <span className="sps-search-icon">🔍</span>
        <input
          className="sps-search"
          type="text"
          placeholder={tab === "services" || !showProducts ? "Cerca trattamento..." : "Cerca prodotto..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button type="button" className="sps-clear" onClick={() => setSearch("")}>
            ✕
          </button>
        )}
      </div>

      {(tab === "services" || !showProducts) && showServices && (
        <div className="sps-list">
          {filteredServices.length === 0 && <p className="sps-empty">Nessun trattamento trovato</p>}
          {filteredServices.map(s => {
            const sid = String(s.serviceId);
            const checked = selectedServiceIds.includes(sid);
            return (
              <label key={s.serviceId} className={`sps-item ${checked ? "sps-item--checked" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleService(s.serviceId)} className="sps-checkbox" />
                <span className="sps-item-name">{s.title}</span>
                {s.price && <span className="sps-item-price">{Number(s.price).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>}
              </label>
            );
          })}
        </div>
      )}

      {(tab === "products" || !showServices) && showProducts && (
        <div className="sps-list">
          {filteredProducts.length === 0 && <p className="sps-empty">Nessun prodotto trovato</p>}
          {filteredProducts.map(p => {
            const pid = String(p.productId);
            const checked = selectedProductIds.includes(pid);
            return (
              <label key={p.productId} className={`sps-item ${checked ? "sps-item--checked" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleProduct(p.productId)} className="sps-checkbox" />
                <span className="sps-item-name">{p.name}</span>
                {p.price && <span className="sps-item-price">{Number(p.price).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>}
              </label>
            );
          })}
        </div>
      )}

      {totalSelected > 0 && (
        <p className="sps-total">
          {totalSelected} selezionat{totalSelected === 1 ? "o" : "i"}
        </p>
      )}
    </div>
  );
}
