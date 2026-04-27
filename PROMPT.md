Progetto Beauty Room — React 19 / CSS prefissi per sezione.
Fix puramente UI — nessuna logica backend. Leggi ogni file prima di modificarlo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 1 — Badge "Inattivo" admin: sposta da top-left a bottom-left
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cerca il badge con:
grep -rn "Inattivo\|inactive.*badge\|badge.*inattiv" src/ --include="_.jsx" --include="_.css"

Nel CSS che lo posiziona, sostituisci:
top: 12px → bottom: 12px
left: 12px → left: 12px (invariato)

Così il cuore rimane top-left libero anche per Michela.
Non toccare nessun altro badge o posizionamento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 2 — Pulsante Wishlist nelle pagine di dettaglio: layout stacked full-width
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBIETTIVO: In ServiceDetail E ProductDetail, i pulsanti devono essere
impilati verticalmente, entrambi full-width del contenitore, con questo ordine:
[riga 1] Wishlist — full width, bordi stondati, stile outline gold
[riga 2] Prenota ora / Acquista ora — full width, stile pieno gold

Leggi ServiceDetail.jsx e ProductDetail.jsx per trovare il JSX attuale dei CTA.

Sostituisci il layout CTA con questo pattern (adatta i nomi classi ai prefissi già usati nel file):

── ServiceDetail ──

```jsx
<div className="sd-cta-stack">
  <WishlistHeart itemType="SERVICE" itemId={service.id} variant="detail" />
  <button className="sd-btn-primary" onClick={handleBooking}>
    Prenota ora
  </button>
</div>
```

── ProductDetail ──

```jsx
<div className="pd-cta-stack">
  <WishlistHeart itemType="PRODUCT" itemId={product.id} variant="detail" />
  <button className="pd-btn-primary" onClick={handleBuyNow}>
    Acquista ora
  </button>
</div>
```

Nel CSS (file \_detail.css o equivalente — scopri con grep):

```css
.sd-cta-stack,
.pd-cta-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
  width: 100%;
}

/* forza il WishlistHeart detail a prendere tutta la larghezza */
.sd-cta-stack .wh-btn-detail,
.pd-cta-stack .wh-btn-detail {
  width: 100%;
  justify-content: center;
}

/* stesso stile e dimensione del pulsante primario */
.sd-cta-stack .sd-btn-primary,
.pd-cta-stack .pd-btn-primary {
  width: 100%;
}
```

Se i prefissi nel file sono diversi da sd- e pd-, usa quelli che trovi.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 3 — Cuore rimane bianco quando il pulsante wishlist è in hover/attivo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEMA: Quando si fa hover sul pulsante wishlist (variant=detail),
lo sfondo diventa oro (#b8976a) ma il cuore SVG scompare perché ha
stroke/fill gold e non si vede su sfondo gold.

In WishlistHeart.css, aggiungi queste regole:

```css
/* cuore vuoto su hover */
.wh-btn-detail:hover .wh-icon-empty,
.wh-btn-detail.wh-active .wh-icon-empty {
  stroke: #fffdf8;
  fill: none;
}

/* cuore pieno su hover */
.wh-btn-detail:hover .wh-icon-filled,
.wh-btn-detail.wh-active .wh-icon-filled {
  stroke: #fffdf8;
  fill: #fffdf8;
}

/* testo colore bianco su hover — già presente, verifica che ci sia */
.wh-btn-detail:hover,
.wh-btn-detail.wh-active {
  background: #b8976a;
  color: #fffdf8;
}
```

Verifica che la classe .wh-active venga aggiunta al pulsante quando
wishlisted === true (controlla WishlistHeart.jsx).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Badge "Inattivo" è bottom-left su tutte le card (non top-left)
2. Il cuore wishlist card è top-left e non si sovrappone ad altri badge
3. In ServiceDetail: wishlist (top) e prenota ora (sotto), entrambi full-width
4. In ProductDetail: wishlist (top) e acquista ora (sotto), entrambi full-width
5. Il cuore SVG è bianco (#fffdf8) quando il pulsante è in hover o .wh-active
6. Il testo del pulsante wishlist è bianco su hover
7. Su mobile i due pulsanti rimangono impilati e full-width
8. Nessun altro componente è stato toccato
