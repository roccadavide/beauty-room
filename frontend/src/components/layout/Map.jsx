const Map = () => {
  return (
    <div
      className="map-container"
      style={{ height: "350px" }}
      data-lenis-prevent
      onMouseEnter={() => window.__lenis?.stop()}
      onMouseLeave={() => window.__lenis?.start()}
    >
      <iframe
        title="Mappa Beauty Room"
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2736.0993920298256!2d9.462541476226559!3d45.692932671078665!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4786ada52f162efd%3A0xcebdea647a990fce!2sBeauty%20room!5e1!3m2!1sit!2sit!4v1755613292689!5m2!1sit!2sit"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen=""
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      ></iframe>
    </div>
  );
};

export default Map;
