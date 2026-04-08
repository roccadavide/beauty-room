// src/components/common/SEO.jsx
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE = {
  name: "Beauty Room di Michela",
  tagline: "Centro estetico specializzato in laser e trattamenti estetici avanzati",
  url: "https://www.beauty-room.it",
  locale: "it_IT",
  // ⚠️  COMPILARE con immagine reale (1200×630px, caricata su Cloudinary o /public)
  defaultImage: "https://www.beauty-room.it/og-default.jpg",
  themeColor: "#fffdf8",
};

const DEFAULT_DESC =
  "Beauty Room di Michela: centro estetico a [CITTÀ] specializzato in laser per la depilazione definitiva, trattamenti viso, estetica avanzata e benessere. Prenota online.";

/**
 * Props:
 *  title        – titolo pagina (senza site name)
 *  description  – meta description (max ~155 char)
 *  image        – URL immagine OG (opzionale, fallback a default)
 *  noindex      – bool, true per pagine admin/private
 *  type         – og:type, default "website" (usa "article" per blog)
 *  jsonLd       – object | array di oggetti JSON-LD aggiuntivi
 */
const SEO = ({ title, description, image, noindex = false, type = "website", jsonLd }) => {
  const { pathname } = useLocation();
  const canonical = `${SITE.url}${pathname}`;
  const fullTitle = title ? `${title} | ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;
  const metaDesc = description || DEFAULT_DESC;
  const ogImage = image || SITE.defaultImage;

  return (
    <Helmet>
      {/* ── Base ─────────────────────────────────────────── */}
      <html lang="it" />
      <title>{fullTitle}</title>
      <meta name="description" content={metaDesc} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* ── Open Graph ───────────────────────────────────── */}
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={SITE.locale} />

      {/* ── Twitter / X Card ─────────────────────────────── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={ogImage} />

      {/* ── Theme ────────────────────────────────────────── */}
      <meta name="theme-color" content={SITE.themeColor} />

      {/* ── JSON-LD pagina-specifica ─────────────────────── */}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd])}</script>}
    </Helmet>
  );
};

export default SEO;
