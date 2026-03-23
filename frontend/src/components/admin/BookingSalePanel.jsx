import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { fetchBookingSales, addBookingSale, deleteBookingSale } from "../../api/modules/bookingSales.api";
import { fetchProducts } from "../../api/modules/products.api";

/**
 * Mini-panel per aggiungere prodotti venduti a una prenotazione.
 * Si apre sotto l'ag-item come pannello espandibile.
 */
export default function BookingSalePanel({ bookingId, onClose }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bookingId) return;
    Promise.all([
      fetchBookingSales(bookingId),
      fetchProducts()
    ]).then(([s, p]) => {
      setSales(s);
      setProducts(Array.isArray(p) ? p : (p?.content ?? []));
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const filteredProducts = search.trim()
    ? products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) && p.stock > 0)
    : [];

  const handleAdd = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    setError(null);
    try {
      const dto = {
        productId: selectedProduct.productId,
        productName: selectedProduct.name,
        quantity: qty,
        unitPrice: selectedProduct.price,
      };
      const newSale = await addBookingSale(bookingId, dto);
      setSales(prev => [newSale, ...prev]);
      setSelectedProduct(null);
      setSearch("");
      setQty(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (saleId) => {
    try {
      await deleteBookingSale(bookingId, saleId);
      setSales(prev => prev.filter(s => s.id !== saleId));
    } catch {}
  };

  const total = sales.reduce((s, sale) => s + Number(sale.unitPrice) * sale.quantity, 0);

  return (
    <div className="bsp-panel">
      <div className="bsp-header">
        <span className="bsp-title">🛍️ Prodotti venduti durante questa seduta</span>
        <button className="bsp-close" onClick={onClose}>×</button>
      </div>

      {loading && <div className="bsp-loading"><Spinner size="sm" animation="border" /></div>}
      {error && <p className="bsp-error">{error}</p>}

      {sales.length > 0 && (
        <div className="bsp-sales-list">
          {sales.map(s => (
            <div key={s.id} className="bsp-sale-row">
              <div className="bsp-sale-info">
                <span className="bsp-sale-name">{s.productName}</span>
                <span className="bsp-sale-meta">× {s.quantity} · € {Number(s.unitPrice).toFixed(2)} cad.</span>
              </div>
              <span className="bsp-sale-total">€ {(Number(s.unitPrice) * s.quantity).toFixed(2)}</span>
              <button className="bsp-sale-del" onClick={() => handleDelete(s.id)} title="Rimuovi">×</button>
            </div>
          ))}
          <div className="bsp-sales-total">Totale: € {total.toFixed(2)}</div>
        </div>
      )}

      <div className="bsp-add-section">
        <div className="bsp-search-wrap">
          <input
            className="bsp-search"
            placeholder="Cerca prodotto…"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedProduct(null); }}
          />
          {filteredProducts.length > 0 && !selectedProduct && (
            <div className="bsp-search-results">
              {filteredProducts.slice(0, 8).map(p => (
                <button
                  key={p.productId}
                  className="bsp-result-item"
                  onClick={() => { setSelectedProduct(p); setSearch(p.name); }}
                  type="button"
                >
                  <span>{p.name}</span>
                  <span className="bsp-result-price">€ {p.price?.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="bsp-qty-row">
            <div className="bsp-selected-name">{selectedProduct.name}</div>
            <div className="bsp-qty-wrap">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="bsp-qty-btn">−</button>
              <span className="bsp-qty-num">{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(selectedProduct.stock, q + 1))}
                className="bsp-qty-btn"
                disabled={qty >= selectedProduct.stock}
              >+</button>
            </div>
            <span className="bsp-add-price">€ {(selectedProduct.price * qty).toFixed(2)}</span>
            <button className="bsp-add-btn" onClick={handleAdd} disabled={saving}>
              {saving ? <Spinner size="sm" animation="border" /> : "Aggiungi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
