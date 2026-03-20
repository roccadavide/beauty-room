const DrawerSection = ({ title, icon, children, className = "" }) => (
  <div className={`ud-section ${className}`}>
    {title && (
      <div className="ud-section__header">
        {icon && <span className="ud-section__icon">{icon}</span>}
        <h3 className="ud-section__title">{title}</h3>
      </div>
    )}
    {children}
  </div>
);

export default DrawerSection;
