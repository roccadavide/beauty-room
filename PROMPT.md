Refactor: custom category badge palette for Beauty Room
Files to edit: ServiceCard, ProductCard, ServiceDetail, ProductDetail,
ServicePage, ProductsPage, and a shared CSS file (e.g. global.css
or a new \_badges.css imported in the relevant files).

=== STEP 1 — Shared palette constant ===
Create src/constants/categoryPalette.js with this content:

export const CATEGORY_PALETTE = {
viso: { bg: "#faeee0", color: "#8c6d3f" },
corpo: { bg: "#f2e6d4", color: "#7a5830" },
laser: { bg: "#e2ecf4", color: "#3d6278" },
epilazione: { bg: "#f5e4e8", color: "#8c4055" },
mani: { bg: "#ede6f5", color: "#6a4e8a" },
piedi: { bg: "#e4f0e8", color: "#3d6e50" },
"trucco permanente":{ bg: "#f0e0ec", color: "#7a2d58" },
};

export function getCategoryStyle(label = "") {
const key = label.trim().toLowerCase();
return CATEGORY_PALETTE[key] ?? { bg: "#ede8e0", color: "#5a4a3a" };
}

=== STEP 2 — Remove categoryColorMap from all pages ===
In ServicePage, ProductsPage, ServiceDetail, ProductDetail:

- DELETE the categoryColorMap useMemo entirely.
- REMOVE categoryColorMap from all props passed to ServiceCard/ProductCard.

=== STEP 3 — CategoryBadge component ===
Create src/components/common/CategoryBadge.jsx:

import { getCategoryStyle } from "../../constants/categoryPalette";

export default function CategoryBadge({ label, className = "" }) {
if (!label) return null;
const { bg, color } = getCategoryStyle(label);
return (
<span
className={`cat-badge ${className}`}
style={{ background: bg, color }} >
{label}
</span>
);
}

=== STEP 4 — CSS for .cat-badge ===
Add to global.css (or \_badges.css):

.cat-badge {
display: inline-block;
padding: 0.22em 0.72em;
border-radius: 20px;
font-size: 0.68rem;
font-weight: 600;
letter-spacing: 0.06em;
text-transform: uppercase;
line-height: 1.4;
font-family: 'Montserrat', sans-serif;
white-space: nowrap;
}

=== STEP 5 — Replace Badge in ServiceCard and ProductCard ===
In both components:

- Remove the import of Badge from react-bootstrap.
- Remove categoryColorMap from props.
- Import CategoryBadge from "../../components/common/CategoryBadge".
- Replace:
  <Badge bg={categoryColorMap[...] || "secondary"} className="...">
  {categoriesMap[...] || "..."}
  </Badge>
  with:
  <CategoryBadge label={categoriesMap[s.categoryId] || categoriesMap[p.categoryId] || ""} />

=== STEP 6 — Replace Badge in ServiceDetail and ProductDetail ===
Same replacement inline — use CategoryBadge in place of:
<Badge bg={categoryColorMap[service.categoryId] || "secondary"} className="text-uppercase detail-badge">
{categoriesMap[service.categoryId] || "Senza categoria"}
</Badge>
→
<CategoryBadge label={categoriesMap[service.categoryId] || categoriesMap[product.categoryId] || ""} className="detail-badge" />

Add to \_detail.css:
.detail-badge {
font-size: 0.7rem;
}
(keep existing layout rules, just update the font-size if it was Bootstrap-driven before)

=== STEP 7 — sp-chip filter bar consistency ===
In ServicePage and ProductsPage the filter chips use sp-chip / sp-chip--active classes.
Make the active chip use the gold color instead of any Bootstrap focus ring:
Ensure in the CSS:
.sp-chip--active {
background: var(--card-gold, #b8976a);
color: #fff;
border-color: var(--card-gold, #b8976a);
}
.sp-chip:focus-visible {
outline: 2px solid var(--card-gold, #b8976a);
outline-offset: 2px;
}

Do NOT change any layout, spacing, card dimensions, animations, or other
styling. Only touch badge/chip colors and remove the Bootstrap Badge import
where replaced.
