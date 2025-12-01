import { Helmet } from "react-helmet-async";

const SEO = ({ title, description, url }) => {
  const siteTitle = "Beauty Room di Michela Rossi";
  const defaultDescription = "Centro estetico specializzato in trattamenti viso e corpo, estetica avanzata e benessere.";

  return (
    <Helmet>
      <title>{title ? `${title} | ${siteTitle}` : siteTitle}</title>

      <meta name="description" content={description || defaultDescription} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title ? `${title} | ${siteTitle}` : siteTitle} />
      <meta property="og:description" content={description || defaultDescription} />

      {url && <meta property="og:url" content={url} />}

      <meta name="theme-color" content="#fffdf9" />
    </Helmet>
  );
};

export default SEO;
